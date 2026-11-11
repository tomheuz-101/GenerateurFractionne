import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../generated/prisma/client';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    // Toujours appelé sous SessionGuard, qui garantit la présence de user
    return request.user as User;
  },
);
