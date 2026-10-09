import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor.js';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('debe envolver la respuesta en un formato { success: true, data: ... }', async () => {
    const mockContext = {} as ExecutionContext;
    const mockData = [{ id: 1, cliente: 'Cliente Prueba' }];
    const mockHandler: CallHandler = {
      handle: () => of(mockData),
    };

    const observable = interceptor.intercept(mockContext, mockHandler);
    const result = await firstValueFrom(observable);

    expect(result).toEqual({
      success: true,
      data: mockData,
    });
  });
});
