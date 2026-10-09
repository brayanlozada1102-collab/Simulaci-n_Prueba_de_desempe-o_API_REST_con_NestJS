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
  };

  const mockConfigService = {
    get: vi.fn().mockReturnValue(['secret_api_key_1']),
  };

  const mockUser: User = {
    username: 'advisor_john',
    role: UserRole.ADVISOR,
    name: 'John Advisor',
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

  it('findAll should call service with user', async () => {
    mockRequestsService.findAll.mockResolvedValue([]);
    const result = await controller.findAll(mockUser);
    expect(mockRequestsService.findAll).toHaveBeenCalledWith(mockUser);
    expect(result).toEqual([]);
  });

  it('findOne should call service with id and user', async () => {
    mockRequestsService.findOne.mockResolvedValue({ id: 5 });
    const result = await controller.findOne(5, mockUser);
    expect(mockRequestsService.findOne).toHaveBeenCalledWith(5, mockUser);
    expect(result.id).toBe(5);
  });

  it('updateStatus should call service with id, dto and user', async () => {
    const dto = { status: RequestStatus.IN_PROGRESS };
    mockRequestsService.updateStatus.mockResolvedValue({ id: 5, status: RequestStatus.IN_PROGRESS });
    const result = await controller.updateStatus(5, dto, mockUser);
    expect(mockRequestsService.updateStatus).toHaveBeenCalledWith(5, dto, mockUser);
    expect(result.status).toBe(RequestStatus.IN_PROGRESS);
  });
});
