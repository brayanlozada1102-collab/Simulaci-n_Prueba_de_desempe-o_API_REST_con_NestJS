import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { RequestStatus } from '../entities/request.entity.js';

export class UpdateStatusRequestDto {
  @ApiProperty({
    enum: RequestStatus,
    example: RequestStatus.IN_PROGRESS,
    description: 'New status for the request (PENDING, IN_PROGRESS, RESOLVED)',
  })
  @IsNotEmpty({ message: 'The status field is required.' })
  @IsEnum(RequestStatus, {
    message: 'Invalid status provided. Allowed values: PENDING, IN_PROGRESS, RESOLVED',
  })
  status: RequestStatus;
}
