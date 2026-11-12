import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { PasswordService } from '../auth/password.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, PasswordService],
})
export class ProfileModule {}
