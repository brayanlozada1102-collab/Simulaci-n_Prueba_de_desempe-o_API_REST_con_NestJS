import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new UnauthorizedException('API Key not provided in x-api-key header');
    }

    // Retrieve valid keys from configuration / environment variables
    const configuredKeys = this.configService.get<string[]>('apiKeys') ?? [];
    const validKeys = configuredKeys.length > 0
      ? configuredKeys
      : (process.env.API_KEYS ?? '').split(',').map((k) => k.trim()).filter(Boolean);

    if (validKeys.length === 0) {
      throw new UnauthorizedException('No API keys configured on the server');
    }

    if (!validKeys.includes(apiKey.trim())) {
      throw new UnauthorizedException('Invalid API Key');
    }

    return true;
  }
}
