import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { GarminController } from './garmin.controller';
import { GarminService } from './garmin.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GarminController],
  providers: [GarminService],
})
export class GarminModule {}
