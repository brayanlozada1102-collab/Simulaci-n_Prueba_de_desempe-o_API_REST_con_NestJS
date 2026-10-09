import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { UserAuthGuard } from './user-auth.guard.js';

describe('UserAuthGuard', () => {
  let guard: UserAuthGuard;

  beforeEach(() => {
    guard = new UserAuthGuard();
  });

  const createMockContext = (headerUser?: string) => {
    const request: Record<string, any> = {
      headers: {
        'x-user': headerUser,
      },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    };
  };

  it('allows access and attaches user when x-user exists in memory', () => {
    const { switchToHttp, request } = createMockContext('admin');
    const ctx = { switchToHttp } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.user).toBeDefined();
    expect(request.user.role).toBe('admin');
  });

  it('allows access for advisor_john', () => {
    const { switchToHttp, request } = createMockContext('advisor_john');
    const ctx = { switchToHttp } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
    expect(request.user.role).toBe('advisor');
  });

  it('throws UnauthorizedException if x-user is missing', () => {
    const { switchToHttp } = createMockContext(undefined);
    const ctx = { switchToHttp } as unknown as ExecutionContext;

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException if user is not in memory', () => {
    const { switchToHttp } = createMockContext('unknown_user');
    const ctx = { switchToHttp } as unknown as ExecutionContext;

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
