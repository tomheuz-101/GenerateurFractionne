import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async get(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable.');
    return { email: user.email, vma: user.vma };
  }

  async setVma(userId: number, body: unknown) {
    const raw = (body as { vma?: unknown } | null)?.vma;
    const vma = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(vma) || vma < 8 || vma > 30) {
      throw new BadRequestException('VMA hors limites (8 à 30 km/h).');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { vma },
    });
    return { success: true, vma };
  }

  async changePassword(userId: number, body: unknown) {
    const d = (body ?? {}) as { current?: unknown; new?: unknown };
    const current = typeof d.current === 'string' ? d.current : '';
    const next = typeof d.new === 'string' ? d.new : '';

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable.');

    if (!(await this.passwordService.verify(user.password, current))) {
      throw new ForbiddenException('Mot de passe actuel incorrect.');
    }
    if (next.length < 12) {
      throw new BadRequestException(
        'Nouveau mot de passe trop court (12 caractères minimum).',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: await this.passwordService.hash(next) },
    });
    return { success: true };
  }

  async deleteAccount(userId: number, body: unknown) {
    const d = (body ?? {}) as { password?: unknown };
    const password = typeof d.password === 'string' ? d.password : '';

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable.');

    if (!(await this.passwordService.verify(user.password, password))) {
      throw new ForbiddenException('Mot de passe incorrect.');
    }

    await this.prisma.$transaction([
      this.prisma.session.deleteMany({ where: { userId } }),
      this.prisma.workout.deleteMany({ where: { userId } }),
      this.prisma.planDay.deleteMany({ where: { plan: { userId } } }),
      this.prisma.plan.deleteMany({ where: { userId } }),
      this.prisma.garminLink.deleteMany({ where: { userId } }),
      this.prisma.passwordReset.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { success: true };
  }
}
