import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProfileService } from './profile.service';
import type { User } from '../generated/prisma/client';

@Controller('profile')
@UseGuards(SessionGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  get(@CurrentUser() user: User) {
    return this.profileService.get(user.id);
  }

  @Post('vma')
  setVma(@CurrentUser() user: User, @Body() body: unknown) {
    return this.profileService.setVma(user.id, body);
  }

  @Post('password')
  changePassword(@CurrentUser() user: User, @Body() body: unknown) {
    return this.profileService.changePassword(user.id, body);
  }

  @Post('delete')
  async remove(
    @CurrentUser() user: User,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.profileService.deleteAccount(user.id, body);
    res.clearCookie('sid');
    return out;
  }
}
