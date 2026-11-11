import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STEP_TYPES = ['warmup', 'cooldown', 'interval', 'recovery'] as const;
const STEP_KINDS = ['time', 'distance'] as const;

interface WorkoutRecord {
  id: number;
  name: string;
  data: unknown;
  updatedAt: Date | null;
}

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- Validation (port de read_workout_body) ----------------

  private parseBody(body: unknown): { name: string; data: Record<string, unknown> } {
    const d = (body ?? {}) as Record<string, unknown>;

    const name = String(d.name ?? '').trim().slice(0, 120);
    if (!name) {
      throw new BadRequestException('Donne un nom à la séance.');
    }

    const data = d.data;
    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data) ||
      !Array.isArray((data as Record<string, unknown>).steps) ||
      ((data as { steps: unknown[] }).steps.length === 0) ||
      ((data as { steps: unknown[] }).steps.length > 300)
    ) {
      throw new BadRequestException('Séance invalide.');
    }

    const steps = (data as { steps: unknown[] }).steps;
    steps.forEach((raw, index) => {
      const step = (raw ?? {}) as Record<string, unknown>;

      if (!STEP_TYPES.includes(step.type as never)) {
        throw new BadRequestException(
          `Type d'étape inconnu à l'étape ${index + 1}.`,
        );
      }
      if (!STEP_KINDS.includes(step.kind as never)) {
        throw new BadRequestException(
          `Type de durée inconnu à l'étape ${index + 1}.`,
        );
      }
      const value = Number(step.value);
      if (!Number.isFinite(value) || value <= 0) {
        throw new BadRequestException(
          `Valeur invalide à l'étape ${index + 1}.`,
        );
      }

      // Cibles d'allure : les deux bornes ensemble ou aucune
      const hasMin = step.paceMinSecPerKm !== undefined
        && step.paceMinSecPerKm !== null
        && step.paceMinSecPerKm !== '';
      const hasMax = step.paceMaxSecPerKm !== undefined
        && step.paceMaxSecPerKm !== null
        && step.paceMaxSecPerKm !== '';

      if (hasMin !== hasMax) {
        throw new BadRequestException(
          `Les deux bornes d'allure doivent être renseignées à l'étape ${index + 1}.`,
        );
      }
      if (hasMin && hasMax) {
        const paceMin = Number(step.paceMinSecPerKm);
        const paceMax = Number(step.paceMaxSecPerKm);
        if (!Number.isFinite(paceMin) || !Number.isFinite(paceMax)
          || paceMin <= 0 || paceMax <= 0) {
          throw new BadRequestException(
            `Les allures de l'étape ${index + 1} doivent être positives.`,
          );
        }
        if (paceMin > paceMax) {
          throw new BadRequestException(
            `L'allure minimale doit être inférieure ou égale à l'allure maximale à l'étape ${index + 1}.`,
          );
        }
      }
    });

    return { name, data: data as Record<string, unknown> };
  }

  workoutJson(workout: WorkoutRecord) {
    return {
      id: workout.id,
      name: workout.name,
      data: workout.data,
      updated: workout.updatedAt ? workout.updatedAt.toISOString() : null,
    };
  }

  // ---------------- CRUD ----------------

  async list(userId: number) {
    const rows = await this.prisma.workout.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return { success: true, workouts: rows.map((w) => this.workoutJson(w)) };
  }

  async create(userId: number, body: unknown) {
    const { name, data } = this.parseBody(body);
    const workout = await this.prisma.workout.create({
      data: { userId, name, data: data as object },
    });
    return { success: true, workout: this.workoutJson(workout) };
  }

  private async ownWorkout(userId: number, workoutId: number) {
    const workout = await this.prisma.workout.findFirst({
      where: { id: workoutId, userId },
    });
    if (!workout) {
      throw new NotFoundException('Séance introuvable.');
    }
    return workout;
  }

  async update(userId: number, workoutId: number, body: unknown) {
    await this.ownWorkout(userId, workoutId);
    const { name, data } = this.parseBody(body);
    const workout = await this.prisma.workout.update({
      where: { id: workoutId },
      data: { name, data: data as object },
    });
    return { success: true, workout: this.workoutJson(workout) };
  }

  async rename(userId: number, workoutId: number, body: unknown) {
    const d = (body ?? {}) as Record<string, unknown>;
    const name = String(d.name ?? '').trim().slice(0, 120);
    if (!name) {
      throw new BadRequestException('Nom vide.');
    }
    await this.ownWorkout(userId, workoutId);
    const workout = await this.prisma.workout.update({
      where: { id: workoutId },
      data: { name },
    });
    return { success: true, workout: this.workoutJson(workout) };
  }

  async duplicate(userId: number, workoutId: number) {
    const workout = await this.ownWorkout(userId, workoutId);
    const copy = await this.prisma.workout.create({
      data: {
        userId,
        name: `${workout.name} (copie)`.slice(0, 120),
        data: workout.data as object,
      },
    });
    return { success: true, workout: this.workoutJson(copy) };
  }

  async remove(userId: number, workoutId: number) {
    await this.ownWorkout(userId, workoutId);
    await this.prisma.workout.delete({ where: { id: workoutId } });
    return { success: true };
  }
}
