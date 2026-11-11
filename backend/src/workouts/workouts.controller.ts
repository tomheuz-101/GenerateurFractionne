import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkoutsService } from './workouts.service';
import type { User } from '../generated/prisma/client';

@Controller('workouts')
@UseGuards(SessionGuard)
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.workoutsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: unknown) {
    return this.workoutsService.create(user.id, body);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.workoutsService.update(user.id, id, body);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.workoutsService.rename(user.id, id, body);
  }

  @Post(':id/duplicate')
  duplicate(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.workoutsService.duplicate(user.id, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.workoutsService.remove(user.id, id);
  }
}
