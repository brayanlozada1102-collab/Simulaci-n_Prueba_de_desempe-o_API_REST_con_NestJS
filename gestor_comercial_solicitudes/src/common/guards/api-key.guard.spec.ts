import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard.js';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'apiKeys') return ['clave1', 'clave2'];
        return undefined;
      }),
    };
    guard = new ApiKeyGuard(mockConfigService as ConfigService);
  });

  const createMockContext = (headerValue?: string) => {
    const request = {
      headers: {
        'x-api-key': headerValue,
      },
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('permite acceso si x-api-key coincide con una de las claves configuradas', () => {
    const ctx1 = createMockContext('clave1');
    expect(guard.canActivate(ctx1)).toBe(true);

    const ctx2 = createMockContext('clave2');
    expect(guard.canActivate(ctx2)).toBe(true);
  });

  it('lanza UnauthorizedException si no se envía x-api-key', () => {
    const ctx = createMockContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('lanza UnauthorizedException si la x-api-key enviada es inválida', () => {
    const ctx = createMockContext('clave_invalida');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
