import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionGuard } from '../auth/session.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import type { User } from '../generated/prisma/client';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Delete('users/:id')
  deleteUser(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminService.deleteUser(user.id, id);
  }

  @Post('users/:id/password')
  resetPassword(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.resetPassword(id);
  }

  @Get('invites')
  listInvites() {
    return this.adminService.listInvites();
  }

  @Post('invites')
  createInvite(@Body() body: unknown) {
    const email = (body as { email?: unknown } | null)?.email;
    return this.adminService.createInvite(
      typeof email === 'string' ? email : undefined,
    );
  }

  @Delete('invites/:id')
  deleteInvite(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteInvite(id);
  }
}
