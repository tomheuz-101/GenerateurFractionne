import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';
import { PasswordService } from '../auth/password.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, PasswordService],
})
export class AdminModule {}
