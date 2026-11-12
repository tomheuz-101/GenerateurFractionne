import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  DistanceDuration,
  GarminConnect,
  NoTarget,
  PaceTarget,
  Step,
  StepType,
  TimeDuration,
  WorkoutBuilder,
  WorkoutType,
} from '@flow-js/garmin-connect';
import { FitWriter } from '@markw65/fit-file-writer';
import { PrismaService } from '../prisma/prisma.service';
import { dec, enc } from './garmin-crypto';

interface DeferredCode {
  promise: Promise<string>;
  resolve: (code: string) => void;
  reject: (err: Error) => void;
}

interface PendingLogin {
  client: GarminConnect;
  deferred: DeferredCode;
  loginPromise: Promise<void>;
  mfaRequested: boolean;
  done: boolean;
  error: unknown;
}

interface RawStep {
  type?: string;
  kind?: string;
  value?: number;
  paceMinSecPerKm?: number | null;
  paceMaxSecPerKm?: number | null;
}

const STEP_TYPES: Record<string, StepType> = {
  warmup: StepType.WarmUp,
  recovery: StepType.Recovery,
  interval: StepType.Run,
  cooldown: StepType.Cooldown,
};

const MFA_TIMEOUT_MS = 10 * 60 * 1000; // comme le Flask : 10 minutes
const CONNECT_WAIT_MS = 8000;

@Injectable()
export class GarminService {
  private readonly pendingLogins = new Map<number, PendingLogin>();

  constructor(private readonly prisma: PrismaService) {}

  // ---------------- Jetons ----------------

  private async saveTokens(userId: number, client: GarminConnect) {
    const tokens = client.exportToken() as unknown;
    await this.prisma.garminLink.upsert({
      where: { userId },
      create: { userId, tokens: enc(JSON.stringify(tokens)) },
      update: { tokens: enc(JSON.stringify(tokens)), pending: null, pendingAt: null },
    });
  }

  private async clientFor(userId: number): Promise<GarminConnect> {
    const link = await this.prisma.garminLink.findUnique({ where: { userId } });
    if (!link || !link.tokens) {
      throw new UnauthorizedException(
        'Compte Garmin non connecté : connecte-le dans le profil.',
      );
    }
    const tokens = JSON.parse(dec(link.tokens)) as Record<string, unknown>;
    const oauth1 = tokens.oauth1 ?? tokens.oauth1Token;
    const oauth2 = tokens.oauth2 ?? tokens.oauth2Token;
    const client = new GarminConnect();
    (client as unknown as { loadToken: (a: unknown, b: unknown) => void }).loadToken(oauth1, oauth2);
    return client;
  }

  private static errorMessage(err: unknown): string {
    return String(err instanceof Error ? err.message : err).slice(0, 150);
  }

  // ---------------- Connexion / MFA ----------------

  async status(userId: number) {
    const link = await this.prisma.garminLink.findUnique({ where: { userId } });
    return {
      linked: Boolean(link && link.tokens),
      mfaPending: Boolean(link && link.pending),
    };
  }

  async connect(userId: number, email: string, password: string) {
    if (this.pendingLogins.has(userId)) {
      throw new BadRequestException('Connexion Garmin déjà en cours.');
    }

    let deferred!: DeferredCode;
    const promise = new Promise<string>((resolve, reject) => {
      deferred = { promise, resolve, reject };
    });
    const timer = setTimeout(
      () => deferred.reject(new Error('Délai dépassé, recommence la connexion.')),
      MFA_TIMEOUT_MS,
    );

    const state: PendingLogin = {
      client: new GarminConnect({ username: email, password }),
      deferred,
      loginPromise: null as unknown as Promise<void>,
      mfaRequested: false,
      done: false,
      error: null,
    };

    state.loginPromise = state.client
      .login(email, password, {
        mfaHandler: async () => {
          state.mfaRequested = true;
          return deferred.promise;
        },
      })
      .then(() => {
        state.done = true;
        clearTimeout(timer);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        state.error = err;
        throw err;
      });

    this.pendingLogins.set(userId, state);

    // Identifiants invalides : échec rapide. Demande MFA : on le signale
    // tout de suite, la connexion se terminera via /api/garmin/mfa.
    await Promise.race([
      state.loginPromise.catch(() => undefined),
      new Promise((r) => setTimeout(r, CONNECT_WAIT_MS)),
    ]);

    if (state.error) {
      this.pendingLogins.delete(userId);
      throw new BadRequestException(
        'Connexion Garmin refusée : ' + GarminService.errorMessage(state.error),
      );
    }
    if (state.mfaRequested) {
      await this.prisma.garminLink.upsert({
        where: { userId },
        create: { userId, pendingAt: new Date() },
        update: { pendingAt: new Date() },
      });
      return { mfaRequired: true };
    }
    if (!state.done) {
      // Réseau lent ni échec ni MFA : on attend la fin de la connexion.
      try {
        await state.loginPromise;
      } catch {
        // géré ci-dessous via state.error
      }
      if (state.error) {
        this.pendingLogins.delete(userId);
        throw new BadRequestException(
          'Connexion Garmin refusée : ' + GarminService.errorMessage(state.error),
        );
      }
    }

    await this.saveTokens(userId, state.client);
    this.pendingLogins.delete(userId);
    return { mfaRequired: false };
  }

  async completeMfa(userId: number, code: string) {
    const state = this.pendingLogins.get(userId);
    if (!state || !state.mfaRequested) {
      throw new BadRequestException(
        'Demande expirée : recommence la connexion Garmin.',
      );
    }
    state.deferred.resolve(code);
    try {
      await state.loginPromise;
    } catch (err) {
      this.pendingLogins.delete(userId);
      throw new BadRequestException(
        'Code refusé : ' + GarminService.errorMessage(err),
      );
    }
    await this.saveTokens(userId, state.client);
    this.pendingLogins.delete(userId);
    return { linked: true };
  }

  async disconnect(userId: number) {
    await this.prisma.garminLink.deleteMany({ where: { userId } });
    return { linked: false };
  }

  // ---------------- Envoi d'une séance ----------------

  private async ownWorkout(userId: number, workoutId: number) {
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
    });
    if (!workout) throw new NotFoundException('Séance introuvable.');
    return workout;
  }

  async sendWorkout(userId: number, workoutId: number) {
    const workout = await this.ownWorkout(userId, workoutId);
    const rawSteps = ((workout.data as Record<string, unknown>)?.steps ??
      []) as RawStep[];

    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new BadRequestException('La séance ne contient aucune étape.');
    }

    const wb = new WorkoutBuilder(WorkoutType.Running, workout.name);

    rawSteps.forEach((step, index) => {
      const stepType = STEP_TYPES[step.type ?? 'interval'];
      if (!stepType) {
        throw new BadRequestException('Type d’étape inconnu à l’étape ' + (index + 1) + '.');
      }
      const value = Number(step.value);
      if (!(value > 0)) {
        throw new BadRequestException(
          'Valeur invalide à l’étape ' + (index + 1) + '.',
        );
      }
      const duration =
        step.kind === 'distance'
          ? DistanceDuration.fromKilometers(value / 1000)
          : TimeDuration.fromSeconds(value);

      let target: unknown = new NoTarget();
      const pmin = Number(step.paceMinSecPerKm);
      const pmax = Number(step.paceMaxSecPerKm);
      if (stepType === StepType.Run && pmin > 0 && pmax > 0) {
        if (pmin > pmax) {
          throw new BadRequestException(
            'Allure minimale supérieure à l’allure maximale à l’étape ' +
              (index + 1) + '.',
          );
        }
        // Garmin attend une allure centrale + un delta en secondes.
        const center = (pmin + pmax) / 2;
        const delta = Math.max(0, Math.round((pmax - pmin) / 2));
        target = PaceTarget.pace(Math.floor(center / 60), Math.round(center % 60), delta);
      }

      wb.addStep(new Step(stepType, duration, target as never));
    });

    const client = await this.clientFor(userId);
    const result = (await client.createWorkout(wb.build())) as Record<
      string,
      unknown
    >;

    const garminWorkoutId = result?.workoutId;
    if (!garminWorkoutId) {
      throw new BadRequestException(
        'Garmin n’a pas retourné d’identifiant de séance. L’envoi n’a pas pu être confirmé.',
      );
    }

    // Vérification de la présence dans Garmin Connect
    await client.getWorkoutDetail({ workoutId: String(garminWorkoutId) });

    const paceTargets = rawSteps.filter(
      (s) =>
        s.type === 'interval' &&
        s.paceMinSecPerKm != null &&
        s.paceMaxSecPerKm != null,
    ).length;

    return {
      workoutId: String(garminWorkoutId),
      paceTargets,
      message: 'Séance envoyée et vérifiée dans Garmin Connect !',
    };
  }

  // ---------------- Export .fit ----------------

  buildFit(name: string, rawSteps: RawStep[]): Buffer {
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      throw new BadRequestException('La séance ne contient aucune étape.');
    }

    const writer = new FitWriter();
    const start = writer.time(new Date());

    writer.writeMessage(
      'file_id',
      {
        type: 'workout',
        manufacturer: 'garmin',
        product: 0,
        serial_number: 12345,
        time_created: start,
      },
      null,
      true,
    );

    writer.writeMessage(
      'workout',
      {
        sport: 'running',
        wkt_name: name.slice(0, 16),
        num_valid_steps: rawSteps.length,
      },
      null,
      true,
    );

    rawSteps.forEach((step, index) => {
      const value = Number(step.value);
      if (!(value > 0)) {
        throw new BadRequestException(
          'Valeur invalide à l’étape ' + (index + 1) + '.',
        );
      }
      writer.writeMessage('workout_step', {
        message_index: index,
        wkt_step_name: (step.type ?? 'interval').slice(0, 16),
        intensity: 'active',
        duration_time: step.kind === 'time' ? value * 1000 : undefined,
        duration_distance: step.kind === 'distance' ? value : undefined,
      });
    });

    const view = writer.finish();
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
  }

  async exportFit(userId: number, workoutId: number) {
    const workout = await this.ownWorkout(userId, workoutId);
    const rawSteps = ((workout.data as Record<string, unknown>)?.steps ??
      []) as RawStep[];
    return this.buildFit(workout.name, rawSteps);
  }
}
