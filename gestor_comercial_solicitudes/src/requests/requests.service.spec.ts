import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestsService } from './requests.service.js';
import { Request, RequestStatus } from './entities/request.entity.js';
import { SolicitudHistorial, EventoTipo } from './entities/solicitud-historial.entity.js';
import { User, UserRole } from '../common/auth/users.data.js';

describe('RequestsService', () => {
  let service: RequestsService;

  const mockQueryBuilder: any = {
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn(),
  };

  const mockRequestRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockHistoryRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
  };

  const mockEntityManager = {
    create: vi.fn((entityClass, data) => ({ ...data })),
    save: vi.fn(async (_entityClass, data) => ({ id: data.id || 1, ...data })),
  };

  const mockDataSource = {
    transaction: vi.fn(async (cb: (manager: any) => Promise<any>) => cb(mockEntityManager)),
  };

  const adminUser: User = { username: 'admin', role: UserRole.ADMIN, name: 'Admin' };
  const supervisorUser: User = { username: 'supervisor', role: UserRole.SUPERVISOR, name: 'Supervisor' };
  const advisor1: User = { username: 'advisor_john', role: UserRole.ADVISOR, name: 'John' };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService,
        {
          provide: getRepositoryToken(Request),
          useValue: mockRequestRepository,
        },
        {
          provide: getRepositoryToken(SolicitudHistorial),
          useValue: mockHistoryRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('BR-01 / RN-07 / RN-09: Commercial Request Registration', () => {
    it('should register request with PENDING status and auto-assign to advisor when creator is advisor', async () => {
      const dto = {
        client: 'ABC Corp',
        description: 'Requires commercial support',
      };

      const result = await service.create(dto, advisor1);

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Request,
        expect.objectContaining({
          client: 'ABC Corp',
          description: 'Requires commercial support',
          advisor: 'advisor_john',
          status: RequestStatus.PENDING,
          version: 1,
        }),
      );
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        SolicitudHistorial,
        expect.objectContaining({
          tipoEvento: EventoTipo.CREACION,
          valorNuevo: 'PENDIENTE',
          usuarioActor: 'advisor_john',
        }),
      );
      expect(result.advisor).toBe('advisor_john');
    });

    it('Escenario 12: Creación por un supervisor queda sin asesor asignado y con evento CREACION', async () => {
      const dto = {
        cliente: 'Ferretería El Norte',
        descripcion: 'Coordinar visita de seguimiento',
      };

      const result = await service.create(dto, supervisorUser);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        Request,
        expect.objectContaining({
          client: 'Ferretería El Norte',
          description: 'Coordinar visita de seguimiento',
          advisor: null,
          status: RequestStatus.PENDING,
          version: 1,
        }),
      );
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        SolicitudHistorial,
        expect.objectContaining({
          tipoEvento: EventoTipo.CREACION,
          valorNuevo: 'PENDIENTE',
          usuarioActor: 'supervisor',
        }),
      );
      expect(result.advisor).toBeNull();
    });
  });

  describe('BR-02 / RN-08: Query with Filters and Pagination', () => {
    it('admin and supervisor query all requests with pagination', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[{ id: 1 }, { id: 2 }], 2]);

      const res = await service.findAll({ page: 1, limit: 10 }, adminUser);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(res.items).toHaveLength(2);
      expect(res.pagination.total).toBe(2);
      expect(res.pagination.totalPages).toBe(1);
    });

    it('Escenario 05: advisor only queries requests assigned to them (cannot bypass with filter)', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[{ id: 1, advisor: 'advisor_john' }], 1]);

      const res = await service.findAll(
        { asesor: 'advisor_mary', page: 1, limit: 10 },
        advisor1,
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'request.advisor = :userAdvisor',
        { userAdvisor: 'advisor_john' },
      );
      expect(res.items).toHaveLength(1);
    });

    it('advisor can query an individual request that belongs to them', async () => {
      const requestItem = { id: 1, client: 'Client 1', advisor: 'advisor_john', status: RequestStatus.PENDING };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      const result = await service.findOne(1, advisor1);
      expect(result).toEqual(requestItem);
    });

    it('advisor is rejected with 403 Forbidden when querying another advisor request', async () => {
      const requestItem = { id: 2, client: 'Client 2', advisor: 'advisor_mary', status: RequestStatus.PENDING };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      await expect(service.findOne(2, advisor1)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 NotFound if request does not exist', async () => {
      mockRequestRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999, adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('RN-07: Assignment and Reassignment', () => {
    it('Escenario 01: supervisor assigns request to existing advisor with ASIGNACION event', async () => {
      const requestItem = {
        id: 15,
        advisor: null,
        status: RequestStatus.PENDING,
      };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      const assignDto = {
        asesorId: 'asesor02',
        getAssignedAdvisor: () => 'asesor02',
      } as any;

      const result = await service.assignAdvisor(15, assignDto, supervisorUser);

      expect(result.advisor).toBe('asesor02');
      expect(mockEntityManager.create).toHaveBeenCalledWith(
        SolicitudHistorial,
        expect.objectContaining({
          tipoEvento: EventoTipo.ASIGNACION,
          solicitudId: 15,
          valorAnterior: null,
          valorNuevo: 'asesor02',
          usuarioActor: 'supervisor',
        }),
      );
    });

    it('Escenario 02: rejects assignment to non-existent user or user without advisor role with 400', async () => {
      const assignDto = {
        asesorId: 'ghost_advisor',
        getAssignedAdvisor: () => 'ghost_advisor',
      } as any;

      await expect(
        service.assignAdvisor(15, assignDto, supervisorUser),
      ).rejects.toThrow(BadRequestException);

      const adminAssignDto = {
        asesorId: 'admin',
        getAssignedAdvisor: () => 'admin',
      } as any;

      await expect(
        service.assignAdvisor(15, adminAssignDto, supervisorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('Escenario 04: rejects reassigning a RESOLVED request with 409 Conflict', async () => {
      const requestItem = {
        id: 15,
        advisor: 'advisor_john',
        status: RequestStatus.RESOLVED,
      };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      const assignDto = {
        asesorId: 'advisor_mary',
        getAssignedAdvisor: () => 'advisor_mary',
      } as any;

      await expect(
        service.assignAdvisor(15, assignDto, supervisorUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('BR-03 / RN-09: Status Transition with Audit History', () => {
    it('Escenario 08: allows valid transition from PENDING to IN_PROGRESS and saves history', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.PENDING,
        version: 1,
      };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      const dto = {
        status: RequestStatus.IN_PROGRESS,
        getResolvedStatus: () => RequestStatus.IN_PROGRESS,
        getExpectedVersion: () => 1,
      } as any;

      const updated = await service.updateStatus(1, dto, advisor1);
      expect(updated.status).toBe(RequestStatus.IN_PROGRESS);
      expect(updated.version).toBe(2);

      expect(mockEntityManager.create).toHaveBeenCalledWith(
        SolicitudHistorial,
        expect.objectContaining({
          tipoEvento: EventoTipo.ESTADO,
          solicitudId: 1,
          valorAnterior: 'PENDIENTE',
          valorNuevo: 'EN_GESTION',
          usuarioActor: 'advisor_john',
        }),
      );
    });

    it('Escenario 09: rejects transition if expectedVersion does not match current version with 409 Conflict', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.PENDING,
        version: 2,
      };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      const dto = {
        status: RequestStatus.IN_PROGRESS,
        getResolvedStatus: () => RequestStatus.IN_PROGRESS,
        getExpectedVersion: () => 1, // Mismatched version
      } as any;

      await expect(service.updateStatus(1, dto, advisor1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects direct transition from PENDING to RESOLVED with 400', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.PENDING,
        version: 1,
      };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      const dto = {
        status: RequestStatus.RESOLVED,
        getResolvedStatus: () => RequestStatus.RESOLVED,
        getExpectedVersion: () => undefined,
      } as any;

      await expect(service.updateStatus(1, dto, advisor1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects modifying an already RESOLVED request with 400', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.RESOLVED,
        version: 1,
      };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      const dto = {
        status: RequestStatus.IN_PROGRESS,
        getResolvedStatus: () => RequestStatus.IN_PROGRESS,
        getExpectedVersion: () => undefined,
      } as any;

      await expect(service.updateStatus(1, dto, supervisorUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects transition when advisor attempts to change another advisor request with 403', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_mary',
        status: RequestStatus.PENDING,
        version: 1,
      };
      mockRequestRepository.findOne.mockResolvedValue(requestItem);

      const dto = {
        status: RequestStatus.IN_PROGRESS,
        getResolvedStatus: () => RequestStatus.IN_PROGRESS,
        getExpectedVersion: () => undefined,
      } as any;

      await expect(service.updateStatus(1, dto, advisor1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('RN-09: Audit History Query', () => {
    it('admin can query history of any request', async () => {
      mockRequestRepository.findOne.mockResolvedValue({ id: 10, advisor: 'advisor_john' });
      mockHistoryRepository.find.mockResolvedValue([
        { id: 1, solicitudId: 10, tipoEvento: 'CREACION' },
      ]);

      const history = await service.getHistory(10, adminUser);
      expect(history).toHaveLength(1);
    });

    it('advisor can query history of request assigned to them', async () => {
      mockRequestRepository.findOne.mockResolvedValue({ id: 10, advisor: 'advisor_john' });
      mockHistoryRepository.find.mockResolvedValue([
        { id: 1, solicitudId: 10, tipoEvento: 'CREACION' },
      ]);

      const history = await service.getHistory(10, advisor1);
      expect(history).toHaveLength(1);
    });

    it('Escenario 11: advisor receives 403 Forbidden when querying history of another advisor request', async () => {
      mockRequestRepository.findOne.mockResolvedValue({ id: 10, advisor: 'advisor_mary' });

      await expect(service.getHistory(10, advisor1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 404 NotFound if request does not exist when querying history', async () => {
      mockRequestRepository.findOne.mockResolvedValue(null);

      await expect(service.getHistory(999, adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
