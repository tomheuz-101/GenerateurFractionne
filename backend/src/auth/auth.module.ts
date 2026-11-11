import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionGuard } from './session.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionGuard],
  exports: [AuthService, PasswordService, SessionGuard],
})
export class AuthModule {}
