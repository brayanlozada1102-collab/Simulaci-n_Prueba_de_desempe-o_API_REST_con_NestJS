import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'AdvisorIdRequired', async: false })
export class AdvisorIdRequiredConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as Record<string, any>;
    const val = obj.asesorId ?? obj.advisorId ?? obj.asesor ?? obj.advisor;
    if (typeof val !== 'string') return false;
    return val.trim().length > 0;
  }

  defaultMessage() {
    return 'The asesorId (or advisorId) field is required and cannot be empty.';
  }
}

export class AssignRequestDto {
  @ApiPropertyOptional({
    example: 'asesor02',
    description: 'Identifier or username of the advisor to assign (must exist with advisor role)',
  })
  @IsOptional()
  @IsString({ message: 'The asesorId field must be a string.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  asesorId?: string;

  @ApiPropertyOptional({
    example: 'advisor_john',
    description: 'English alias for asesorId',
  })
  @IsOptional()
  @IsString({ message: 'The advisorId field must be a string.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  advisorId?: string;

  @ApiPropertyOptional({
    example: 'asesor02',
    description: 'Asesor username alias',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  asesor?: string;

  @ApiPropertyOptional({
    example: 'advisor_john',
    description: 'Advisor username alias',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  advisor?: string;

  @Validate(AdvisorIdRequiredConstraint)
  private readonly _advisorValidation: boolean = true;

  getAssignedAdvisor(): string {
    const raw = this.asesorId ?? this.advisorId ?? this.asesor ?? this.advisor ?? '';
    return raw.trim();
  }
}
