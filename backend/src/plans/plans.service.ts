import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PlanDayJson {
  id: number;
  week: number;
  weekday: number;
  workoutId: number | null;
  workoutName: string | null;
  label: string | null;
  done: boolean;
}

export interface PlanJson {
  id: number;
  name: string;
  weeks: number;
  start: string;
  days: PlanDayJson[];
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------- Helpers ----------------

  private async ownPlan(userId: number, planId: number) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) {
      throw new NotFoundException('Plan introuvable.');
    }
    return plan;
  }

  private async planJson(plan: {
    id: number;
    name: string;
    weeks: number;
    startDate: Date;
  }): Promise<PlanJson> {
    const days = await this.prisma.planDay.findMany({
      where: { planId: plan.id },
      orderBy: [{ week: 'asc' }, { weekday: 'asc' }],
    });

    const workoutIds = days
      .map((d) => d.workoutId)
      .filter((id): id is number => id !== null);

    const names = new Map<number, string>();
    if (workoutIds.length > 0) {
      const workouts = await this.prisma.workout.findMany({
        where: { id: { in: workoutIds } },
        select: { id: true, name: true },
      });
      for (const w of workouts) names.set(w.id, w.name);
    }

    return {
      id: plan.id,
      name: plan.name,
      weeks: plan.weeks,
      start: plan.startDate.toISOString().slice(0, 10),
      days: days.map((d) => ({
        id: d.id,
        week: d.week,
        weekday: d.weekday,
        workoutId: d.workoutId,
        workoutName: d.workoutId ? names.get(d.workoutId) ?? null : null,
        label: d.label,
        done: d.done,
      })),
    };
  }

  // ---------------- CRUD ----------------

  async list(userId: number) {
    const rows = await this.prisma.plan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const plans: PlanJson[] = [];
    for (const plan of rows) {
      plans.push(await this.planJson(plan));
    }
    return { success: true, plans };
  }

  async create(userId: number, body: unknown) {
    const d = (body ?? {}) as Record<string, unknown>;

    const name = String(d.name ?? '').trim().slice(0, 120);
    if (!name) {
      throw new BadRequestException('Donne un nom au plan.');
    }

    const weeks = Number(d.weeks);
    if (!Number.isInteger(weeks) || weeks < 1 || weeks > 30) {
      throw new BadRequestException('Durée : 1 à 30 semaines.');
    }

    let start: Date;
    const rawStart = String(d.start ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawStart)) {
      start = new Date(rawStart + 'T12:00:00.000Z');
      if (Number.isNaN(start.getTime())) {
        throw new BadRequestException('Date de début invalide.');
      }
    } else {
      start = new Date();
      start.setUTCHours(12, 0, 0, 0);
    }

    const plan = await this.prisma.plan.create({
      data: { userId, name, weeks, startDate: start },
    });

    const days: {
      planId: number;
      week: number;
      weekday: number;
    }[] = [];
    for (let week = 1; week <= weeks; week += 1) {
      for (let weekday = 1; weekday <= 7; weekday += 1) {
        days.push({ planId: plan.id, week, weekday });
      }
    }
    await this.prisma.planDay.createMany({ data: days });

    return { success: true, plan: await this.planJson(plan) };
  }

  async setDay(userId: number, planId: number, dayId: number, body: unknown) {
    await this.ownPlan(userId, planId);

    const day = await this.prisma.planDay.findFirst({
      where: { id: dayId, planId },
    });
    if (!day) {
      throw new NotFoundException('Jour introuvable.');
    }

    const d = (body ?? {}) as Record<string, unknown>;

    if ('workoutId' in d) {
      const workoutId = d.workoutId === null ? null : Number(d.workoutId);
      if (workoutId === null) {
        await this.prisma.planDay.update({
          where: { id: day.id },
          data: { workoutId: null },
        });
      } else {
        if (!Number.isInteger(workoutId)) {
          throw new BadRequestException('Séance invalide.');
        }
        const workout = await this.prisma.workout.findFirst({
          where: { id: workoutId, userId },
        });
        if (!workout) {
          throw new NotFoundException('Séance introuvable.');
        }
        // Snapshot figé au moment de l'assignation
        await this.prisma.planDay.update({
          where: { id: day.id },
          data: {
            workoutId: workout.id,
            label: null,
            workoutSnapshot: workout.data as object,
          },
        });
      }
    }

    if ('label' in d) {
      const label = String(d.label ?? '').trim().slice(0, 120) || null;
      await this.prisma.planDay.update({
        where: { id: day.id },
        data: { label, workoutId: label ? null : undefined },
      });
    }

    // Toute modification réinitialise la coche « fait »
    await this.prisma.planDay.update({
      where: { id: day.id },
      data: { done: false, doneAt: null },
    });

    return { success: true };
  }

  async toggleDone(
    userId: number,
    planId: number,
    dayId: number,
    body: unknown,
  ) {
    await this.ownPlan(userId, planId);

    const day = await this.prisma.planDay.findFirst({
      where: { id: dayId, planId },
    });
    if (!day) {
      throw new NotFoundException('Jour introuvable.');
    }

    const done = Boolean((body as Record<string, unknown> | null)?.done);
    await this.prisma.planDay.update({
      where: { id: day.id },
      data: { done, doneAt: done ? new Date() : null },
    });

    return { success: true, done };
  }

  async remove(userId: number, planId: number) {
    await this.ownPlan(userId, planId);
    await this.prisma.planDay.deleteMany({ where: { planId } });
    await this.prisma.plan.delete({ where: { id: planId } });
    return { success: true };
  }
}
