
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly sessionDurationMs =
    30 * 24 * 60 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async createSession(userId: number) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    const expiresAt = new Date(
      Date.now() + this.sessionDurationMs,
    );

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token,
      expiresAt,
    };
  }

  async validateSession(token: string) {
    if (!token) {
      throw new UnauthorizedException('Session invalide');
    }

    const tokenHash = this.hashToken(token);

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) {
        await this.prisma.session.delete({
          where: { id: session.id },
        });
      }

      throw new UnauthorizedException('Session expirée ou invalide');
    }

    return session.user;
  }

  async deleteSession(token: string) {
    if (!token) return;

    const tokenHash = this.hashToken(token);

    await this.prisma.session.deleteMany({
      where: { tokenHash },
    });
  }
}
