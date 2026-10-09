import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, RequestStatus } from './entities/request.entity.js';
import { CreateRequestDto } from './dto/create-request.dto.js';
import { UpdateStatusRequestDto } from './dto/update-status-request.dto.js';
import { User, UserRole } from '../common/auth/users.data.js';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepository: Repository<Request>,
  ) {}

  /**
   * BR-01: Commercial Request Registration
   * - Any identified user with a valid role can register.
   * - Initial status is ALWAYS PENDING.
   * - If user has advisor role, the responsible advisor is strictly set to themselves.
   */
  async create(createRequestDto: CreateRequestDto, user: User): Promise<Request> {
    const isAdvisor = user.role === UserRole.ADVISOR || user.role === UserRole.ASESOR;
    const assignedAdvisor = isAdvisor
      ? user.username
      : (createRequestDto.advisor?.trim() || user.username);

    const newRequest = this.requestRepository.create({
      client: createRequestDto.client.trim(),
      description: createRequestDto.description.trim(),
      advisor: assignedAdvisor,
      status: RequestStatus.PENDING,
    });

    return await this.requestRepository.save(newRequest);
  }

  /**
   * BR-02: Query Commercial Requests
   * - admin and supervisor: can query all requests.
   * - advisor: can ONLY query requests assigned to their own user (filtered at DB level).
   */
  async findAll(user: User): Promise<Request[]> {
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPERVISOR) {
      return await this.requestRepository.find({
        order: { createdAt: 'DESC' },
      });
    }

    return await this.requestRepository.find({
      where: { advisor: user.username },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * BR-02: Individual Request Query
   * - Validates existence.
   * - If user is advisor, they can only view requests assigned to them.
   */
  async findOne(id: number, user: User): Promise<Request> {
    const request = await this.requestRepository.findOne({ where: { id } });

    if (!request) {
      throw new NotFoundException(`Request with ID ${id} was not found.`);
    }

    const isAdvisor = user.role === UserRole.ADVISOR || user.role === UserRole.ASESOR;
    if (isAdvisor && request.advisor !== user.username) {
      throw new ForbiddenException(
        'Access denied: As an advisor you can only view requests assigned to your user.',
      );
    }

    return request;
  }

  /**
   * BR-03: Status Transition
   * - Supervisors and admins can update any existing request.
   * - Advisors can only update their own requests.
   * - Allowed transitions:
   *   PENDING -> IN_PROGRESS
   *   IN_PROGRESS -> RESOLVED
   * - Rejects PENDING -> RESOLVED directly and reopening RESOLVED.
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

    const isAdvisor = user.role === UserRole.ADVISOR || user.role === UserRole.ASESOR;
    if (isAdvisor && request.advisor !== user.username) {
      throw new ForbiddenException(
        'Access denied: As an advisor you cannot modify requests assigned to another user.',
      );
    }

    const currentStatus = request.status;
    const newStatus = updateStatusDto.status;

    // Validation: cannot reopen or modify resolved requests
    if (currentStatus === RequestStatus.RESOLVED) {
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
    if (currentStatus === RequestStatus.PENDING) {
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
    if (currentStatus === RequestStatus.IN_PROGRESS) {
      if (newStatus !== RequestStatus.RESOLVED) {
        throw new BadRequestException(
          'Invalid transition: From IN_PROGRESS you can only advance to RESOLVED.',
        );
      }
    }

    request.status = newStatus;
    return await this.requestRepository.save(request);
  }
}
