import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'generateur-fractionne-api',
      timestamp: new Date().toISOString(),
    };
  }
}
