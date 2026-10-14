import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const ALLOWED_STATUS_FILTERS = [
  'PENDIENTE',
  'EN_GESTION',
  'RESUELTA',
  'PENDING',
  'IN_PROGRESS',
  'RESOLVED',
];

@ValidatorConstraint({ name: 'DateRangeValid', async: false })
export class DateRangeValidConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as Record<string, any>;
    const desde = obj.desde ?? obj.from;
    const hasta = obj.hasta ?? obj.to;
    if (desde && hasta) {
      const d1 = new Date(desde);
      const d2 = new Date(hasta);
      if (d1.getTime() > d2.getTime()) {
        return false;
      }
    }
    return true;
  }

  defaultMessage() {
    return 'La fecha desde no puede ser posterior a la fecha hasta.';
  }
}

export class FilterRequestsDto {
  @ApiPropertyOptional({
    enum: ALLOWED_STATUS_FILTERS,
    example: 'EN_GESTION',
    description: 'Filter by request status (PENDIENTE, EN_GESTION, RESUELTA)',
  })
  @IsOptional()
  @IsIn(ALLOWED_STATUS_FILTERS, {
    message: 'Invalid status filter. Allowed values: PENDIENTE, EN_GESTION, RESUELTA, PENDING, IN_PROGRESS, RESOLVED',
  })
  estado?: string;

  @ApiPropertyOptional({
    enum: ALLOWED_STATUS_FILTERS,
    description: 'English alias for estado',
  })
  @IsOptional()
  @IsIn(ALLOWED_STATUS_FILTERS, {
    message: 'Invalid status filter.',
  })
  status?: string;

  @ApiPropertyOptional({
    example: 'asesor02',
    description: 'Filter by assigned advisor username (ignored/overridden for advisor roles)',
  })
  @IsOptional()
  @IsString({ message: 'asesor filter must be a string' })
  asesor?: string;

  @ApiPropertyOptional({
    description: 'English alias for asesor',
  })
  @IsOptional()
  @IsString()
  advisor?: string;

  @ApiPropertyOptional({
    example: 'Ferretería',
    description: 'Case-insensitive partial search on client name',
  })
  @IsOptional()
  @IsString({ message: 'cliente filter must be a string' })
  cliente?: string;

  @ApiPropertyOptional({
    description: 'English alias for cliente',
  })
  @IsOptional()
  @IsString()
  client?: string;

  @ApiPropertyOptional({
    example: '2026-10-01T00:00:00Z',
    description: 'Filter requests created from this ISO 8601 date',
  })
  @IsOptional()
  @IsISO8601(
    { strict: false },
    { message: 'desde must be a valid ISO 8601 date string' },
  )
  desde?: string;

  @ApiPropertyOptional({
    description: 'English alias for desde',
  })
  @IsOptional()
  @IsISO8601({ strict: false })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T23:59:59Z',
    description: 'Filter requests created up to this ISO 8601 date',
  })
  @IsOptional()
  @IsISO8601(
    { strict: false },
    { message: 'hasta must be a valid ISO 8601 date string' },
  )
  hasta?: string;

  @ApiPropertyOptional({
    description: 'English alias for hasta',
  })
  @IsOptional()
  @IsISO8601({ strict: false })
  to?: string;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Page number for pagination (minimum 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be greater than or equal to 1' })
  page: number = 1;

  @ApiPropertyOptional({
    example: 10,
    default: 10,
    description: 'Number of items per page (minimum 1, maximum 100)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be greater than or equal to 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit: number = 10;

  @Validate(DateRangeValidConstraint)
  private readonly _dateValidation: boolean = true;
}
