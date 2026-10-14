import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Request, RequestStatus } from './entities/request.entity.js';
import {
  EventoTipo,
  SolicitudHistorial,
} from './entities/solicitud-historial.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusRequestDto } from './dto/update-status-request.dto.js';
import { AssignRequestDto } from './dto/assign-request.dto.js';
import { FilterRequestsDto } from './dto/filter-requests.dto.js';
import { IN_MEMORY_USERS, User, UserRole } from '../common/auth/users.data.js';

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepository: Repository<Request>,
    @InjectRepository(SolicitudHistorial)
    private readonly historyRepository: Repository<SolicitudHistorial>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * BR-01 / RN-07 / RN-09: Commercial Request Registration
   * - If creator has advisor role, auto-assigned to themselves.
   * - If creator is admin or supervisor, remains unassigned (null) until explicit assignment.
   * - Normalizes spaces in text fields.
   * - Initial status is ALWAYS PENDING.
   * - Persists initial CREACION event in SolicitudHistorial in the same transaction.
   */
  async create(createRequestDto: CreateRequestDto, user: User): Promise<Request> {
    const isAdvisor =
      user.role === UserRole.ADVISOR || user.role === UserRole.ASESOR;

    const assignedAdvisor = isAdvisor ? user.username : null;

    const rawClient =
      createRequestDto.cliente ?? createRequestDto.client ?? '';
    const rawDescription =
      createRequestDto.descripcion ?? createRequestDto.description ?? '';

    const client = rawClient.trim().replace(/\s+/g, ' ');
    const description = rawDescription.trim().replace(/\s+/g, ' ');

    return await this.dataSource.transaction(async (manager) => {
      const newRequest = manager.create(Request, {
        client,
        description,
        advisor: assignedAdvisor,
        status: RequestStatus.PENDING,
        version: 1,
      });

      const savedRequest = await manager.save(Request, newRequest);

      const historyEvent = manager.create(SolicitudHistorial, {
        solicitudId: savedRequest.id,
        tipoEvento: EventoTipo.CREACION,
        valorAnterior: null,
        valorNuevo: 'PENDIENTE',
        usuarioActor: user.username,
      });

      await manager.save(SolicitudHistorial, historyEvent);

      return savedRequest;
    });
  }

  /**
   * BR-02 / RN-08: Query with Filters and Pagination
   * - Advisors strictly only query requests assigned to their user (permission constraint at DB level).
   * - Filter parameter `asesor` sent by an advisor cannot evade their access restrictions.
   * - Admins and supervisors can query all and filter by advisor.
   * - Supports filters: estado, asesor, cliente (case-insensitive partial match), desde, hasta.
   * - Default pagination: page=1, limit=10 (limit capped at 100).
   * - Returns collection and pagination metadata.
   */
  async findAll(
    filterDto: FilterRequestsDto,
    user: User,
  ): Promise<PaginatedResult<Request>> {
    const queryBuilder = this.requestRepository.createQueryBuilder('request');

    const isAdvisor =
      user.role === UserRole.ADVISOR || user.role === UserRole.ASESOR;

    // Permissions restriction at query builder level
    if (isAdvisor) {
      queryBuilder.andWhere('request.advisor = :userAdvisor', {
        userAdvisor: user.username,
      });
    } else {
      const advisorFilter = filterDto.asesor ?? filterDto.advisor;
      if (advisorFilter && advisorFilter.trim().length > 0) {
        queryBuilder.andWhere('request.advisor = :advisorFilter', {
          advisorFilter: advisorFilter.trim(),
        });
      }
    }

    // Estado / status filter
    const statusFilter = filterDto.estado ?? filterDto.status;
    if (statusFilter) {
      let mappedStatuses: string[] = [];
      if (statusFilter === 'PENDIENTE' || statusFilter === 'PENDING') {
        mappedStatuses = ['PENDING', 'PENDIENTE'];
      } else if (
        statusFilter === 'EN_GESTION' ||
        statusFilter === 'IN_PROGRESS'
      ) {
        mappedStatuses = ['IN_PROGRESS', 'EN_GESTION'];
      } else if (statusFilter === 'RESUELTA' || statusFilter === 'RESOLVED') {
        mappedStatuses = ['RESOLVED', 'RESUELTA'];
      }
      if (mappedStatuses.length > 0) {
        queryBuilder.andWhere('request.status IN (:...statuses)', {
          statuses: mappedStatuses,
        });
      }
    }

    // Cliente / client filter (case-insensitive partial match)
    const clientFilter = filterDto.cliente ?? filterDto.client;
    if (clientFilter && clientFilter.trim().length > 0) {
      queryBuilder.andWhere('LOWER(request.client) LIKE LOWER(:clientFilter)', {
        clientFilter: `%${clientFilter.trim()}%`,
      });
    }

    // Date range filters over createdAt / creadaEn
    const desde = filterDto.desde ?? filterDto.from;
    if (desde) {
      queryBuilder.andWhere('request.createdAt >= :desde', {
        desde: new Date(desde),
      });
    }

    const hasta = filterDto.hasta ?? filterDto.to;
    if (hasta) {
      queryBuilder.andWhere('request.createdAt <= :hasta', {
        hasta: new Date(hasta),
      });
    }

    // Pagination
    const page = Number(filterDto.page) || 1;
    const limit = Number(filterDto.limit) || 10;

    queryBuilder.orderBy('request.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * limit);
    queryBuilder.take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit) || 0;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      page,
      limit,
      total,
      totalPages,
    };
  }

  /**
   * BR-02: Individual Request Query
   */
  async findOne(id: number, user: User): Promise<Request> {
    const request = await this.requestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} was not found.`);
    }

    const isAdvisor =
      user.role === UserRole.ADVISOR || user.role === UserRole.ASESOR;
    if (isAdvisor && request.advisor !== user.username) {
      throw new ForbiddenException(
        'Access denied: As an advisor you can only view requests assigned to your user.',
      );
    }

    return request;
  }

  /**
   * RN-07: Assignment and Reassignment of Requests
   * - Only admin and supervisor can assign or reassign requests.
   * - Assigned user must exist and have advisor role.
   * - Reassigning does not change request status.
   * - Requests in RESOLVED status cannot be reassigned (HTTP 409 Conflict).
   * - Changes and SolicitudHistorial entry are executed in the same transaction.
   */
  async assignAdvisor(
    id: number,
    assignDto: AssignRequestDto,
    user: User,
  ): Promise<Request> {
    const targetAdvisorUsername = assignDto.getAssignedAdvisor();
    const targetUser = IN_MEMORY_USERS[targetAdvisorUsername];

    if (
      !targetUser ||
      (targetUser.role !== UserRole.ADVISOR &&
        targetUser.role !== UserRole.ASESOR)
    ) {
      throw new BadRequestException(
        `El usuario asignado '${targetAdvisorUsername}' no existe o no tiene el rol de asesor.`,
      );
    }

    const request = await this.requestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} was not found.`);
    }

    if (
      request.status === RequestStatus.RESOLVED ||
      (request.status as unknown as string) === 'RESUELTA'
    ) {
      throw new ConflictException(
        'No se puede reasignar una solicitud en estado RESUELTA.',
      );
    }

    return await this.dataSource.transaction(async (manager) => {
      const valorAnterior = request.advisor || null;
      request.advisor = targetUser.username;

      const updatedRequest = await manager.save(Request, request);

      const historyEvent = manager.create(SolicitudHistorial, {
        solicitudId: request.id,
        tipoEvento: EventoTipo.ASIGNACION,
        valorAnterior,
        valorNuevo: targetUser.username,
        usuarioActor: user.username,
      });

      await manager.save(SolicitudHistorial, historyEvent);

      return updatedRequest;
    });
  }

  /**
   * BR-03 / RN-09 / RN-10: Status Transition with Concurrency Control
   * - Advisors can only update their own requests.
   * - Allowed transitions: PENDING -> IN_PROGRESS -> RESOLVED.
   * - Rejects direct PENDING -> RESOLVED and reopening RESOLVED.
   * - Optimistic locking: verifies versionEsperada if supplied.
   * - Increments version and registers ESTADO event in SolicitudHistorial in the same transaction.
   */
  async updateStatus(
    id: number,
    updateStatusDto: UpdateStatusRequestDto,
    user: User,
  ): Promise<Request> {
    const request = await this.requestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} was not found.`);
    }

    const isAdvisor =
      user.role === UserRole.ADVISOR || user.role === UserRole.ASESOR;
    if (isAdvisor && request.advisor !== user.username) {
      throw new ForbiddenException(
        'Access denied: As an advisor you cannot modify requests assigned to another user.',
      );
    }

    // Optimistic locking check (RN-10)
    const expectedVersion = updateStatusDto.getExpectedVersion();
    if (expectedVersion !== undefined && expectedVersion !== request.version) {
      throw new ConflictException(
        'La solicitud fue modificada por otro usuario. Consulta la versión actual.',
      );
    }

    const currentStatus = request.status;
    const newStatus = updateStatusDto.getResolvedStatus();

    // Validation: cannot reopen or modify resolved requests
    if (
      currentStatus === RequestStatus.RESOLVED ||
      (currentStatus as unknown as string) === 'RESUELTA'
    ) {
      throw new BadRequestException(
        'Invalid transition: Cannot modify or reopen a request in RESOLVED status.',
      );
    }

    // Validation: redundant transition
    if (currentStatus === newStatus) {
      throw new BadRequestException(
        `The request is already currently in '${currentStatus}' status.`,
      );
    }

    // Validation: transitions from PENDING
    if (
      currentStatus === RequestStatus.PENDING ||
      (currentStatus as unknown as string) === 'PENDIENTE'
    ) {
      if (newStatus === RequestStatus.RESOLVED) {
        throw new BadRequestException(
          'Invalid transition: Cannot transition directly from PENDING to RESOLVED. It must first transition to IN_PROGRESS.',
        );
      }
      if (newStatus !== RequestStatus.IN_PROGRESS) {
        throw new BadRequestException(
          'Invalid transition: From PENDING you can only transition to IN_PROGRESS.',
        );
      }
    }

    // Validation: transitions from IN_PROGRESS
    if (
      currentStatus === RequestStatus.IN_PROGRESS ||
      (currentStatus as unknown as string) === 'EN_GESTION'
    ) {
      if (newStatus !== RequestStatus.RESOLVED) {
        throw new BadRequestException(
          'Invalid transition: From IN_PROGRESS you can only advance to RESOLVED.',
        );
      }
    }

    return await this.dataSource.transaction(async (manager) => {
      const valorAnterior =
        currentStatus === RequestStatus.PENDING ? 'PENDIENTE' : 'EN_GESTION';
      const valorNuevo =
        newStatus === RequestStatus.IN_PROGRESS ? 'EN_GESTION' : 'RESUELTA';

      request.status = newStatus;
      request.version = (request.version || 1) + 1;

      const updatedRequest = await manager.save(Request, request);

      const historyEvent = manager.create(SolicitudHistorial, {
        solicitudId: request.id,
        tipoEvento: EventoTipo.ESTADO,
        valorAnterior,
        valorNuevo,
        usuarioActor: user.username,
      });

      await manager.save(SolicitudHistorial, historyEvent);

      return updatedRequest;
    });
  }

  /**
   * RN-09: Audit History Query
   * - Admin and supervisor can view history of any request.
   * - Advisor can only view history of requests currently assigned to them.
   * - Read-only for consumers.
   */
  async getHistory(id: number, user: User): Promise<SolicitudHistorial[]> {
    const request = await this.requestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} was not found.`);
    }

    const isAdvisor =
      user.role === UserRole.ADVISOR || user.role === UserRole.ASESOR;
    if (isAdvisor && request.advisor !== user.username) {
      throw new ForbiddenException(
        'Acceso denegado: Un asesor solo puede consultar el historial de solicitudes asignadas a sí mismo.',
      );
    }

    return await this.historyRepository.find({
      where: { solicitudId: id },
      order: { fechaEvento: 'ASC', id: 'ASC' },
    });
  }
}
