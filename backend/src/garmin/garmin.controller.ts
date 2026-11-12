import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { GarminService } from './garmin.service';

@Controller('garmin')
@UseGuards(SessionGuard)
export class GarminController {
  constructor(private readonly garmin: GarminService) {}

  @Get('status')
  status(@CurrentUser('id') userId: number) {
    return this.garmin.status(userId);
  }

  @Post('connect')
  async connect(
    @CurrentUser('id') userId: number,
    @Body() body: Record<string, unknown>,
  ) {
    const email = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');
    if (!email || !password) {
      return { success: false, error: 'E-mail et mot de passe Garmin requis.' };
    }
    const result = await this.garmin.connect(userId, email, password);
    if (result.mfaRequired) {
      return {
        success: false,
        mfaRequired: true,
        error: 'Garmin demande un code de vérification.',
      };
    }
    return { success: true, linked: true };
  }

  @Post('mfa')
  async mfa(
    @CurrentUser('id') userId: number,
    @Body() body: Record<string, unknown>,
  ) {
    const code = String(body?.code ?? '').trim();
    if (!code) {
      return { success: false, error: 'Code de vérification requis.' };
    }
    await this.garmin.completeMfa(userId, code);
    return { success: true, linked: true };
  }

  @Post('disconnect')
  disconnect(@CurrentUser('id') userId: number) {
    return this.garmin.disconnect(userId);
  }

  @Post('send/:workoutId')
  async send(
    @CurrentUser('id') userId: number,
    @Param('workoutId', ParseIntPipe) workoutId: number,
  ) {
    const result = await this.garmin.sendWorkout(userId, workoutId);
    return { success: true, ...result };
  }

  @Get('fit/:workoutId')
  async fit(
    @CurrentUser('id') userId: number,
    @Param('workoutId', ParseIntPipe) workoutId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.garmin.exportFit(userId, workoutId);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="seance_fractionne.fit"',
    );
    res.send(buffer);
  }
}
