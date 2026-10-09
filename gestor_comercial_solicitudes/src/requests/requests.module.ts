import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestsService } from './requests.service.js';
import { RequestsController } from './requests.controller.js';
import { Request } from './entities/request.entity.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { UserAuthGuard } from '../common/guards/user-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

@Module({
  imports: [TypeOrmModule.forFeature([Request])],
  controllers: [RequestsController],
  providers: [
    RequestsService,
    ApiKeyGuard,
    UserAuthGuard,
    RolesGuard,
  ],
  exports: [RequestsService],
})
export class RequestsModule {}
