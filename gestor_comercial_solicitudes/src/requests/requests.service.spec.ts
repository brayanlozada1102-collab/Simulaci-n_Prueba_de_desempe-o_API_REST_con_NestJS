import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service.js';
import { Request, RequestStatus } from './entities/request.entity.js';
import { User, UserRole } from '../common/auth/users.data.js';

describe('RequestsService', () => {
  let service: RequestsService;

  const mockRepository = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
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
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('BR-01: Commercial Request Registration', () => {
    it('should register request with PENDING initial status and assign to advisor when creator is advisor', async () => {
      const dto = {
        client: 'ABC Corp',
        description: 'Requires commercial support',
        advisor: 'someone_else',
      };

      const createdEntity = {
        ...dto,
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.PENDING,
      };

      mockRepository.create.mockReturnValue(createdEntity);
      mockRepository.save.mockResolvedValue(createdEntity);

      const result = await service.create(dto, advisor1);

      expect(mockRepository.create).toHaveBeenCalledWith({
        client: 'ABC Corp',
        description: 'Requires commercial support',
        advisor: 'advisor_john',
        status: RequestStatus.PENDING,
      });
      expect(result.status).toBe(RequestStatus.PENDING);
      expect(result.advisor).toBe('advisor_john');
    });

    it('a supervisor can assign a specific advisor', async () => {
      const dto = {
        client: 'XYZ Corp',
        description: 'Initial consultation',
        advisor: 'advisor_mary',
      };

      const createdEntity = {
        ...dto,
        id: 2,
        status: RequestStatus.PENDING,
      };

      mockRepository.create.mockReturnValue(createdEntity);
      mockRepository.save.mockResolvedValue(createdEntity);

      const result = await service.create(dto, supervisorUser);

      expect(mockRepository.create).toHaveBeenCalledWith({
        client: 'XYZ Corp',
        description: 'Initial consultation',
        advisor: 'advisor_mary',
        status: RequestStatus.PENDING,
      });
      expect(result.advisor).toBe('advisor_mary');
    });
  });

  describe('BR-02: Query Commercial Requests', () => {
    it('admin and supervisor query all requests', async () => {
      mockRepository.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const resAdmin = await service.findAll(adminUser);
      expect(mockRepository.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
      expect(resAdmin).toHaveLength(2);

      const resSupervisor = await service.findAll(supervisorUser);
      expect(resSupervisor).toHaveLength(2);
    });

    it('advisor only queries requests assigned to them in the database query', async () => {
      mockRepository.find.mockResolvedValue([{ id: 1, advisor: 'advisor_john' }]);

      const res = await service.findAll(advisor1);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { advisor: 'advisor_john' },
        order: { createdAt: 'DESC' },
      });
      expect(res).toHaveLength(1);
    });

    it('advisor can query an individual request that belongs to them', async () => {
      const requestItem = { id: 1, client: 'Client 1', advisor: 'advisor_john', status: RequestStatus.PENDING };
      mockRepository.findOne.mockResolvedValue(requestItem);

      const result = await service.findOne(1, advisor1);
      expect(result).toEqual(requestItem);
    });

    it('advisor is rejected with 403 Forbidden when querying another advisor request', async () => {
      const requestItem = { id: 2, client: 'Client 2', advisor: 'advisor_mary', status: RequestStatus.PENDING };
      mockRepository.findOne.mockResolvedValue(requestItem);

      await expect(service.findOne(2, advisor1)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 NotFound if request does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999, adminUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('BR-03: Status Transition', () => {
    it('allows valid transition from PENDING to IN_PROGRESS for advisor on own request', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.PENDING,
      };
      mockRepository.findOne.mockResolvedValue(requestItem);
      mockRepository.save.mockImplementation((s) => Promise.resolve(s));

      const updated = await service.updateStatus(1, { status: RequestStatus.IN_PROGRESS }, advisor1);
      expect(updated.status).toBe(RequestStatus.IN_PROGRESS);
    });

    it('allows valid transition from IN_PROGRESS to RESOLVED', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.IN_PROGRESS,
      };
      mockRepository.findOne.mockResolvedValue(requestItem);
      mockRepository.save.mockImplementation((s) => Promise.resolve(s));

      const updated = await service.updateStatus(1, { status: RequestStatus.RESOLVED }, advisor1);
      expect(updated.status).toBe(RequestStatus.RESOLVED);
    });

    it('rejects direct transition from PENDING to RESOLVED', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.PENDING,
      };
      mockRepository.findOne.mockResolvedValue(requestItem);

      await expect(
        service.updateStatus(1, { status: RequestStatus.RESOLVED }, advisor1),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects modifying an already RESOLVED request', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_john',
        status: RequestStatus.RESOLVED,
      };
      mockRepository.findOne.mockResolvedValue(requestItem);

      await expect(
        service.updateStatus(1, { status: RequestStatus.IN_PROGRESS }, supervisorUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transition when advisor attempts to change another advisor request', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_mary',
        status: RequestStatus.PENDING,
      };
      mockRepository.findOne.mockResolvedValue(requestItem);

      await expect(
        service.updateStatus(1, { status: RequestStatus.IN_PROGRESS }, advisor1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('supervisor and admin can change status of any advisor request', async () => {
      const requestItem = {
        id: 1,
        advisor: 'advisor_mary',
        status: RequestStatus.PENDING,
      };
      mockRepository.findOne.mockResolvedValue(requestItem);
      mockRepository.save.mockImplementation((s) => Promise.resolve(s));

      const updated = await service.updateStatus(1, { status: RequestStatus.IN_PROGRESS }, supervisorUser);
      expect(updated.status).toBe(RequestStatus.IN_PROGRESS);
    });
  });
});
