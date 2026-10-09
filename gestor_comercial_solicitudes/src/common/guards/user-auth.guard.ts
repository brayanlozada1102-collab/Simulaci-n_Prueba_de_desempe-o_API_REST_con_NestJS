import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { IN_MEMORY_USERS } from '../auth/users.data.js';

@Injectable()
export class UserAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const rawUserHeader = request.headers['x-user'];

    if (!rawUserHeader || typeof rawUserHeader !== 'string' || rawUserHeader.trim() === '') {
      throw new UnauthorizedException('x-user header not provided. A valid user must be specified.');
    }

    const username = rawUserHeader.trim().toLowerCase();
    const user = IN_MEMORY_USERS[username];

    if (!user) {
      throw new UnauthorizedException(`User '${username}' is not registered in the system.`);
    }

    // Attach authenticated user to request
    request.user = user;
    return true;
  }
}
