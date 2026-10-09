import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { RequestsService } from './requests.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusRequestDto } from './dto/update-status-request.dto.js';
import { Request } from './entities/request.entity.js';
import { ApiKeyGuard } from '../common/guards/api-key.guard.js';
import { UserAuthGuard } from '../common/guards/user-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { User, UserRole } from '../common/auth/users.data.js';

@ApiTags('Requests')
@ApiSecurity('x-api-key')
@ApiSecurity('x-user')
@ApiHeader({
  name: 'x-api-key',
  description: 'Required API Key header for authentication',
  required: true,
})
@ApiHeader({
  name: 'x-user',
  description: 'Identified user in the system (e.g. admin, supervisor, advisor_john, advisor_mary)',
  required: true,
})
@UseGuards(ApiKeyGuard, UserAuthGuard, RolesGuard)
@Controller(['requests', 'solicitudes'])
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ADVISOR, UserRole.ASESOR)
  @ApiOperation({
    summary: 'Register a commercial request (BR-01)',
    description:
      'Any user with a valid role can register a request. Initial status is always PENDING. If the creator is an advisor, the request is automatically assigned to them.',
  })
  @ApiResponse({
    status: 201,
    description: 'Commercial request registered successfully',
    type: Request,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or missing required DTO fields',
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  create(
    @Body() createRequestDto: CreateRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.create(createRequestDto, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ADVISOR, UserRole.ASESOR)
  @ApiOperation({
    summary: 'Retrieve allowed commercial requests (BR-02)',
    description:
      'Admins and supervisors retrieve all requests. Advisors only retrieve requests assigned to their user directly from the database query.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of commercial requests filtered by role',
    type: [Request],
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  findAll(@CurrentUser() user: User) {
    return this.requestsService.findAll(user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ADVISOR, UserRole.ASESOR)
  @ApiOperation({
    summary: 'Retrieve an individual request by ID (BR-02)',
    description:
      'Returns the details of a request. If the requester is an advisor, they can only view requests assigned to them.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Numeric ID of the request',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Commercial request details',
    type: Request,
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied: Advisor attempting to access another advisor request',
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.findOne(id, user);
  }

  @Patch([':id/status', ':id/estado'])
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ADVISOR, UserRole.ASESOR)
  @ApiOperation({
    summary: 'Update the status of a commercial request (BR-03)',
    description:
      'Valid transitions: PENDING -> IN_PROGRESS -> RESOLVED. Advisors can only update their own requests. Supervisors and admins can update any request.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Numeric ID of the request to update',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Request status updated successfully',
    type: Request,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition',
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Access denied: Advisor attempting to update another advisor request',
  })
  @ApiResponse({
    status: 404,
    description: 'Request not found',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.updateStatus(id, updateStatusDto, user);
  }
}
