import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { RequestStatus } from '../entities/request.entity.js';

const ALLOWED_STATUS_INPUTS: Record<string, RequestStatus> = {
  PENDING: RequestStatus.PENDING,
  IN_PROGRESS: RequestStatus.IN_PROGRESS,
  RESOLVED: RequestStatus.RESOLVED,
  PENDIENTE: RequestStatus.PENDING,
  EN_GESTION: RequestStatus.IN_PROGRESS,
  RESUELTA: RequestStatus.RESOLVED,
};

@ValidatorConstraint({ name: 'StatusRequired', async: false })
export class StatusRequiredConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as Record<string, any>;
    const val = obj.status ?? obj.estado;
    if (typeof val !== 'string') return false;
    return val in ALLOWED_STATUS_INPUTS;
  }

  defaultMessage() {
    return 'The status (or estado) field is required. Allowed values: PENDING, IN_PROGRESS, RESOLVED, PENDIENTE, EN_GESTION, RESUELTA';
  }
}

export class UpdateStatusRequestDto {
  @ApiPropertyOptional({
    enum: RequestStatus,
    example: RequestStatus.IN_PROGRESS,
    description: 'New status in English (PENDING, IN_PROGRESS, RESOLVED)',
  })
  @IsOptional()
  status?: RequestStatus;

  @ApiPropertyOptional({
    example: 'EN_GESTION',
    description: 'Nuevo estado en español (PENDIENTE, EN_GESTION, RESUELTA)',
  })
  @IsOptional()
  estado?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Expected optimistic locking version of the request (RN-10)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'versionEsperada must be an integer' })
  @Min(1, { message: 'versionEsperada must be at least 1' })
  versionEsperada?: number;

  @ApiPropertyOptional({
    description: 'English alias for versionEsperada',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @Validate(StatusRequiredConstraint)
  private readonly _statusValidation: boolean = true;

  getResolvedStatus(): RequestStatus {
    const val = (this.status ?? this.estado ?? '').toString();
    return ALLOWED_STATUS_INPUTS[val] ?? RequestStatus.PENDING;
  }

  getExpectedVersion(): number | undefined {
    return this.versionEsperada ?? this.expectedVersion;
  }
}
