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

@ValidatorConstraint({ name: 'ClientRequired', async: false })
export class ClientRequiredConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as Record<string, any>;
    const clientVal = obj.client !== undefined ? obj.client : obj.cliente;
    if (typeof clientVal !== 'string') return false;
    return clientVal.trim().length > 0;
  }

  defaultMessage() {
    return 'The client field (or cliente) is required, cannot be empty or only whitespace.';
  }
}

@ValidatorConstraint({ name: 'DescriptionRequired', async: false })
export class DescriptionRequiredConstraint implements ValidatorConstraintInterface {
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as Record<string, any>;
    const descVal = obj.description !== undefined ? obj.description : obj.descripcion;
    if (typeof descVal !== 'string') return false;
    return descVal.trim().length > 0;
  }

  defaultMessage() {
    return 'The description field (or descripcion) is required, cannot be empty or only whitespace.';
  }
}

export class CreateRequestDto {
  @ApiPropertyOptional({
    example: 'Tech Solutions LLC',
    description: 'Name of the client (required, cannot be only spaces)',
  })
  @IsOptional()
  @IsString({ message: 'The client field must be a string.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  client?: string;

  @ApiPropertyOptional({
    example: 'Ferretería El Norte',
    description: 'Nombre del cliente en español (requerido si no se envía client)',
  })
  @IsOptional()
  @IsString({ message: 'The cliente field must be a string.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  cliente?: string;

  @ApiPropertyOptional({
    example: 'Interested in implementing cloud infrastructure.',
    description: 'Reason or description of the request (required, non-empty)',
  })
  @IsOptional()
  @IsString({ message: 'The description field must be a string.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  description?: string;

  @ApiPropertyOptional({
    example: 'Coordinar visita de seguimiento',
    description: 'Descripción de la solicitud en español (requerido si no se envía description)',
  })
  @IsOptional()
  @IsString({ message: 'The descripcion field must be a string.' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  descripcion?: string;

  @ApiPropertyOptional({
    example: 'advisor_john',
    description:
      'Assigned advisor (optional for supervisors and admins; auto-assigned if creator has advisor role)',
  })
  @IsOptional()
  @IsString({ message: 'The advisor field must be a string.' })
  advisor?: string;

  @ApiPropertyOptional({
    example: 'asesor_juan',
    description: 'Asesor asignado en español (opcional)',
  })
  @IsOptional()
  @IsString({ message: 'The asesor field must be a string.' })
  asesor?: string;

  @Validate(ClientRequiredConstraint)
  private readonly _clientValidation: boolean = true;

  @Validate(DescriptionRequiredConstraint)
  private readonly _descValidation: boolean = true;
}
