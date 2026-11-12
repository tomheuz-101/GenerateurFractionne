import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { User } from '../generated/prisma/client';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as User | undefined;
    const admin = (this.config.get<string>('ADMIN_EMAIL') ?? '')
      .trim()
      .toLowerCase();
    const email = (user?.email ?? '').trim().toLowerCase();
    if (!admin || email !== admin) {
      throw new ForbiddenException('Réservé à l’administrateur.');
    }
    return true;
  }
}
