import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { User, UserRole } from '../auth/users.data.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<(UserRole | string)[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles required, allow access to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: User | undefined = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied: Unable to verify user role.');
    }

    const userRole = user.role;
    const hasRole =
      requiredRoles.includes(userRole) ||
      (userRole === UserRole.ADVISOR && requiredRoles.includes(UserRole.ASESOR)) ||
      (userRole === UserRole.ASESOR && requiredRoles.includes(UserRole.ADVISOR));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Role '${user.role}' has insufficient permissions for this resource.`,
      );
    }

    return true;
  }
}
