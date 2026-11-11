import {
  Body,
  Controller,
  Get,
  HttpException,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionGuard } from './session.guard';
import { CurrentUser } from './current-user.decorator';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import type { User } from '../generated/prisma/client';

// ---------------- Rate limiting simple en mémoire ----------------

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const attempts = new Map<string, { count: number; resetAt: number }>();

function throttle(key: string) {
  const entry = attempts.get(key);
  if (entry && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS) {
    throw new HttpException(
      'Trop de tentatives. Réessaie dans quelques minutes.',
      429,
    );
  }
}

function record(key: string) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

// ----------------------------------------------------------------

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.register(dto);
    return this.authService.startSession(res, user.id);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = `${req.ip ?? 'inconnu'}|${dto.email.trim().toLowerCase()}`;
    throttle(key);

    try {
      const user = await this.authService.login(dto);
      attempts.delete(key);
      return this.authService.startSession(res, user.id);
    } catch (error) {
      record(key);
      throw error;
    }
  }

  @UseGuards(SessionGuard)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteSession(req.cookies?.['sid']);
    res.clearCookie('sid', { path: '/' });
    return { success: true };
  }

  @UseGuards(SessionGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return {
      email: user.email,
      vma: user.vma,
      isAdmin: this.authService.isAdmin(user.email),
    };
  }
}
