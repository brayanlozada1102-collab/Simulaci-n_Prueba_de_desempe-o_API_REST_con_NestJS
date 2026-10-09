import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../auth/users.data.js';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (UserRole | string)[]) => SetMetadata(ROLES_KEY, roles);
