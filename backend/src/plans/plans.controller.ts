import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PlansService } from './plans.service';
import type { User } from '../generated/prisma/client';

@Controller('plans')
@UseGuards(SessionGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.plansService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: unknown) {
    return this.plansService.create(user.id, body);
  }

  @Put(':planId/days/:dayId')
  setDay(
    @CurrentUser() user: User,
    @Param('planId', ParseIntPipe) planId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() body: unknown,
  ) {
    return this.plansService.setDay(user.id, planId, dayId, body);
  }

  @Post(':planId/days/:dayId/done')
  toggleDone(
    @CurrentUser() user: User,
    @Param('planId', ParseIntPipe) planId: number,
    @Param('dayId', ParseIntPipe) dayId: number,
    @Body() body: unknown,
  ) {
    return this.plansService.toggleDone(user.id, planId, dayId, body);
  }

  @Delete(':planId')
  remove(
    @CurrentUser() user: User,
    @Param('planId', ParseIntPipe) planId: number,
  ) {
    return this.plansService.remove(user.id, planId);
  }
}
