import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Global validation pipeline (BR-05)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global interceptor to standardize successful responses (BR-06)
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global custom exception filter to normalize errors (BR-06)
  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI / Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Commercial Requests REST API')
    .setDescription(
      'REST API for managing and tracking commercial requests with role-based access control and API Key protection.\n\n' +
        '### Authentication and Authorization:\n' +
        '- **x-api-key**: Required header containing the configured API Key.\n' +
        '- **x-user**: Required header containing the username (roles: admin, supervisor, advisor).\n\n' +
        '### In-Memory Test Users:\n' +
        '- `admin` (Role: admin - Full access)\n' +
        '- `supervisor` (Role: supervisor - Views all, updates status)\n' +
        '- `advisor_john` (Role: advisor - Manages assigned requests only)\n' +
        '- `advisor_mary` (Role: advisor - Manages assigned requests only)\n' +
        '- `advisor1` / `advisor2` (Role: advisor)\n',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Authentication API Key (defined in API_KEYS env var)',
      },
      'x-api-key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-user',
        in: 'header',
        description: 'User identifier (e.g. admin, supervisor, advisor_john)',
      },
      'x-user',
    )
    .addTag('Requests', 'Operations for registering, retrieving, and updating commercial requests')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Interactive Swagger Docs available at: http://localhost:${port}/docs`);
}
await bootstrap();
