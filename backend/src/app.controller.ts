
import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'generateur-fractionne-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db-check')
  async checkDatabase() {
    const result = await this.prisma.$queryRaw<{ result: number }[]>`
      SELECT 1 AS result
    `;

    return {
      status: 'ok',
      database: result[0]?.result === 1 ? 'connected' : 'unexpected',
    };
  }
}
