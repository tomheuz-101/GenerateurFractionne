import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly sessionDurationMs = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  isAdmin(email: string): boolean {
    const admin = (this.config.get<string>('ADMIN_EMAIL') ?? '')
      .trim()
      .toLowerCase();
    return admin !== '' && email.trim().toLowerCase() === admin;
  }

  // ---------------- Inscription ----------------

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Réponse volontairement vague : ne pas révéler l'existence d'un compte
      throw new ForbiddenException(
        'Inscription impossible avec ces informations.',
      );
    }

    // Hors administrateur : valider le code d'invitation AVANT la transaction
    let invite: { id: number; email: string | null } | null = null;
    if (!this.isAdmin(email)) {
      const code = (dto.inviteCode ?? '').trim();
      if (!code) {
        throw new BadRequestException('Un code d’invitation est requis.');
      }

      const found = await this.prisma.invite.findUnique({
        where: { codeHash: this.hashToken(code) },
      });

      if (
        !found ||
        found.usedAt ||
        (found.expiresAt && found.expiresAt <= new Date())
      ) {
        throw new BadRequestException('Code d’invitation invalide ou expiré.');
      }

      if (found.email && found.email.toLowerCase() !== email) {
        throw new BadRequestException(
          'Ce code d’invitation est réservé à une autre adresse.',
        );
      }

      invite = { id: found.id, email: found.email };
    }

    const password = await this.passwordService.hash(dto.password);

    // Transaction : création du compte + consommation de l'invitation
    // sont atomicques ; une même invitation ne peut pas servir deux fois.
    const user = await this.prisma.$transaction(async (tx) => {
      if (invite) {
        // Reprendre l'invitation DANS la transaction avec un verrou logique :
        // la contrainte usedAt est re-vérifiée via updateMany conditionnel.
        const consumed = await tx.invite.updateMany({
          where: { id: invite.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (consumed.count === 0) {
          throw new BadRequestException(
            'Code d’invitation invalide ou expiré.',
          );
        }
      }

      const created = await tx.user.create({
        data: { email, password },
      });

      if (invite) {
        await tx.invite.update({
          where: { id: invite.id },
          data: { usedById: created.id },
        });
      }

      return created;
    });

    return user;
  }

  // ---------------- Connexion ----------------

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    // Nettoyage opportuniste des sessions expirées
    await this.prisma.session.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });

    const user = await this.prisma.user.findUnique({ where: { email } });

    if (
      !user ||
      !(await this.passwordService.verify(user.password, dto.password))
    ) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }

    return user;
  }

  // ---------------- Sessions ----------------

  async startSession(res: Response, userId: number) {
    const { token } = await this.createSession(userId);

    res.cookie('sid', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: this.sessionDurationMs,
      path: '/',
    });

    return { success: true };
  }

  async createSession(userId: number) {
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);

    const expiresAt = new Date(Date.now() + this.sessionDurationMs);

    await this.prisma.session.create({
      data: { userId, tokenHash, expiresAt },
    });

    return { token, expiresAt };
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
        await this.prisma.session.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Session expirée ou invalide');
    }

    return session.user;
  }

  async deleteSession(token: string) {
    if (!token) return;
    await this.prisma.session.deleteMany({
      where: { tokenHash: this.hashToken(token) },
    });
  }
}
