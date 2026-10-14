import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RequestsController } from './requests.controller.js';
import { RequestsService } from './requests.service.js';
import { RequestStatus } from './entities/request.entity.js';
import { User, UserRole } from '../common/auth/users.data.js';

describe('RequestsController', () => {
  let controller: RequestsController;

  const mockRequestsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    updateStatus: vi.fn(),
    assignAdvisor: vi.fn(),
    getHistory: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn().mockReturnValue(['secret_api_key_1']),
  };

  const mockUser: User = {
    username: 'advisor_john',
    role: UserRole.ADVISOR,
    name: 'John Advisor',
  };

  const mockSupervisor: User = {
    username: 'supervisor',
    role: UserRole.SUPERVISOR,
    name: 'Supervisor',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RequestsController],
      providers: [
        {
          provide: RequestsService,
          useValue: mockRequestsService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<RequestsController>(RequestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create should call service with dto and user', async () => {
    const dto = { client: 'Client A', description: 'Consultation' };
    mockRequestsService.create.mockResolvedValue({ id: 1, ...dto, status: RequestStatus.PENDING });

    const result = await controller.create(dto, mockUser);
    expect(mockRequestsService.create).toHaveBeenCalledWith(dto, mockUser);
    expect(result.id).toBe(1);
  });

  it('findAll should call service with filterDto and user', async () => {
    const filterDto = { page: 1, limit: 10 };
    const paginated = { items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    mockRequestsService.findAll.mockResolvedValue(paginated);

    const result = await controller.findAll(filterDto, mockUser);
    expect(mockRequestsService.findAll).toHaveBeenCalledWith(filterDto, mockUser);
    expect(result).toEqual(paginated);
  });

  it('findOne should call service with id and user', async () => {
    mockRequestsService.findOne.mockResolvedValue({ id: 5 });
    const result = await controller.findOne(5, mockUser);
    expect(mockRequestsService.findOne).toHaveBeenCalledWith(5, mockUser);
    expect(result.id).toBe(5);
  });

  it('assignAdvisor should call service with id, dto and user (RN-07)', async () => {
    const assignDto = { asesorId: 'asesor02', getAssignedAdvisor: () => 'asesor02' } as any;
    mockRequestsService.assignAdvisor.mockResolvedValue({ id: 5, advisor: 'asesor02' });

    const result = await controller.assignAdvisor(5, assignDto, mockSupervisor);
    expect(mockRequestsService.assignAdvisor).toHaveBeenCalledWith(5, assignDto, mockSupervisor);
    expect(result.advisor).toBe('asesor02');
  });

  it('getHistory should call service with id and user (RN-09)', async () => {
    const history = [{ id: 1, solicitudId: 5, tipoEvento: 'CREACION' }];
    mockRequestsService.getHistory.mockResolvedValue(history);

    const result = await controller.getHistory(5, mockUser);
    expect(mockRequestsService.getHistory).toHaveBeenCalledWith(5, mockUser);
    expect(result).toEqual(history);
  });

  it('updateStatus should call service with id, dto and user', async () => {
    const dto = { status: RequestStatus.IN_PROGRESS, getResolvedStatus: () => RequestStatus.IN_PROGRESS } as any;
    mockRequestsService.updateStatus.mockResolvedValue({ id: 5, status: RequestStatus.IN_PROGRESS });

    const result = await controller.updateStatus(5, dto, mockUser);
    expect(mockRequestsService.updateStatus).toHaveBeenCalledWith(5, dto, mockUser);
    expect(result.status).toBe(RequestStatus.IN_PROGRESS);
  });
});
