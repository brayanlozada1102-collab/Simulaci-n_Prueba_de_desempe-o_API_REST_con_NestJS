import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({
    example: 'Tech Solutions LLC',
    description: 'Name of the client (required, non-empty)',
  })
  @IsNotEmpty({ message: 'The client field is required and cannot be empty.' })
  @IsString({ message: 'The client field must be a string.' })
  client: string;

  @ApiProperty({
    example: 'Interested in implementing cloud infrastructure and security auditing.',
    description: 'Reason or description of the request (required, non-empty)',
  })
  @IsNotEmpty({ message: 'The description field is required and cannot be empty.' })
  @IsString({ message: 'The description field must be a string.' })
  description: string;

  @ApiPropertyOptional({
    example: 'advisor_john',
    description:
      'Assigned advisor (optional for supervisors and admins; auto-assigned if creator has advisor role)',
  })
  @IsOptional()
  @IsString({ message: 'The advisor field must be a string.' })
  advisor?: string;
}
