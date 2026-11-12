import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        email: true,
        garminLink: { select: { tokens: true } },
        _count: { select: { workouts: true } },
      },
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        garmin: Boolean(u.garminLink?.tokens),
        workouts: u._count.workouts,
      })),
    };
  }

  async deleteUser(actorId: number, uid: number) {
    if (uid === actorId) {
      throw new BadRequestException('Suppression impossible.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: uid } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    await this.prisma.user.delete({ where: { id: uid } });
    return { success: true };
  }

  async resetPassword(uid: number) {
    const user = await this.prisma.user.findUnique({ where: { id: uid } });
    if (!user) throw new NotFoundException('Utilisateur introuvable.');

    const temp = randomBytes(9).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: uid },
        data: { password: await this.passwordService.hash(temp) },
      }),
      this.prisma.session.deleteMany({ where: { userId: uid } }),
    ]);
    return { success: true, password: temp };
  }

  async listInvites() {
    const invites = await this.prisma.invite.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        email: true,
        usedAt: true,
        usedBy: { select: { email: true } },
      },
    });
    return {
      invites: invites.map((i) => ({
        id: i.id,
        email: i.email,
        used: Boolean(i.usedAt),
        usedByEmail: i.usedBy?.email ?? null,
      })),
    };
  }

  async createInvite(email?: string) {
    const code = randomBytes(9).toString('base64url');
    const cleaned = (email ?? '').trim().toLowerCase() || null;
    const invite = await this.prisma.invite.create({
      data: {
        codeHash: this.hashToken(code),
        email: cleaned,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    // Le code en clair n'est visible qu'une seule fois, ici.
    return { success: true, id: invite.id, code };
  }

  async deleteInvite(iid: number) {
    await this.prisma.invite.deleteMany({ where: { id: iid } });
    return { success: true };
  }
}
