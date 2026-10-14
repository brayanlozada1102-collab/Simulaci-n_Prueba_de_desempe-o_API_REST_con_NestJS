import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { RequestsService } from './requests.service.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusRequestDto } from './dto/update-status-request.dto.js';
import { AssignRequestDto } from './dto/assign-request.dto.js';
import { FilterRequestsDto } from './dto/filter-requests.dto.js';
import { Request } from './entities/request.entity.js';
import { SolicitudHistorial } from './entities/solicitud-historial.entity.js';
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
  description:
    'Identified user in the system (e.g. admin, supervisor, advisor_john, asesor02)',
  required: true,
})
@UseGuards(ApiKeyGuard, UserAuthGuard, RolesGuard)
@Controller(['requests', 'solicitudes'])
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ADVISOR, UserRole.ASESOR)
  @ApiOperation({
    summary: 'Register a commercial request (BR-01 / RN-07 / RN-09)',
    description:
      'Any user with a valid role can register a request. Initial status is always PENDING. If created by an advisor, auto-assigned to them. If created by supervisor/admin, remains unassigned. Automatically logs a CREACION event in the audit history.',
  })
  @ApiResponse({
    status: 201,
    description: 'Commercial request registered successfully',
    type: Request,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data, empty strings or whitespace-only fields',
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
    summary: 'Retrieve commercial requests with filters and pagination (BR-02 / RN-08)',
    description:
      'Admins and supervisors retrieve all requests (with optional filters). Advisors strictly retrieve only their own assigned requests. Supports filters by estado, asesor, cliente, and ISO date range (desde, hasta), alongside page and limit pagination.',
  })
  @ApiOkResponse({
    description: 'Paginated list of commercial requests and pagination metadata',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid pagination values (e.g. page=0, limit=-1 or limit>100) or invalid date interval (desde > hasta)',
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  findAll(
    @Query() filterDto: FilterRequestsDto,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.findAll(filterDto, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ADVISOR, UserRole.ASESOR)
  @ApiOperation({
    summary: 'Retrieve an individual request by ID (BR-02)',
    description:
      'Returns the details of a request. Advisors can only view requests assigned to them.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Numeric ID of the request',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Commercial request details',
    type: Request,
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  @ApiForbiddenResponse({
    description: 'Access denied: Advisor attempting to access another advisor request',
  })
  @ApiNotFoundResponse({
    description: 'Request not found',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.findOne(id, user);
  }

  @Patch([':id/asignacion', ':id/assign'])
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @ApiOperation({
    summary: 'Assign or reassign an advisor to a request (RN-07)',
    description:
      'Only admin and supervisor can assign or reassign requests. Target advisor must exist and have advisor role. Requests in RESOLVED status cannot be reassigned (409 Conflict). Registers an ASIGNACION event in audit history.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Numeric ID of the request to assign',
    example: 15,
  })
  @ApiOkResponse({
    description: 'Request successfully assigned to the advisor',
    type: Request,
  })
  @ApiResponse({
    status: 400,
    description: 'Target advisor does not exist or does not have advisor role',
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  @ApiForbiddenResponse({
    description: 'Access denied: Advisors cannot assign or reassign requests',
  })
  @ApiNotFoundResponse({
    description: 'Request not found',
  })
  @ApiConflictResponse({
    description: 'Business conflict: Request is in RESOLVED status and cannot be reassigned',
  })
  assignAdvisor(
    @Param('id', ParseIntPipe) id: number,
    @Body() assignDto: AssignRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.assignAdvisor(id, assignDto, user);
  }

  @Get([':id/historial', ':id/history'])
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ADVISOR, UserRole.ASESOR)
  @ApiOperation({
    summary: 'Query audit history events for a request (RN-09)',
    description:
      'Admins and supervisors can view history for any request. Advisors can strictly only view history for requests currently assigned to them.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Numeric ID of the request',
    example: 15,
  })
  @ApiOkResponse({
    description: 'List of audit events in chronological order',
    type: [SolicitudHistorial],
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  @ApiForbiddenResponse({
    description: 'Access denied: Advisor attempting to view history of a request not assigned to them',
  })
  @ApiNotFoundResponse({
    description: 'Request not found',
  })
  getHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.getHistory(id, user);
  }

  @Patch([':id/status', ':id/estado'])
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ADVISOR, UserRole.ASESOR)
  @ApiOperation({
    summary: 'Update request status with concurrency control (BR-03 / RN-09 / RN-10)',
    description:
      'Valid transitions: PENDING -> IN_PROGRESS -> RESOLVED. Advisors can only update their own requests. Supervisors and admins can update any request. Optimistic concurrency control verifies versionEsperada if sent. Registers an ESTADO event in audit history.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Numeric ID of the request to update',
    example: 15,
  })
  @ApiOkResponse({
    description: 'Request status updated successfully',
    type: Request,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition or reopen attempt',
  })
  @ApiResponse({
    status: 401,
    description: 'x-api-key or x-user missing or invalid',
  })
  @ApiForbiddenResponse({
    description: 'Access denied: Advisor attempting to update another advisor request',
  })
  @ApiNotFoundResponse({
    description: 'Request not found',
  })
  @ApiConflictResponse({
    description: 'Concurrency conflict: Request version does not match versionEsperada',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusRequestDto,
    @CurrentUser() user: User,
  ) {
    return this.requestsService.updateStatus(id, updateStatusDto, user);
  }
}
