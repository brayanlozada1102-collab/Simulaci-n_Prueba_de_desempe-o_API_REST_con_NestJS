import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum RequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

@Entity({ name: 'requests' })
export class Request {
  @ApiProperty({
    example: 1,
    description: 'Unique auto-generated identifier of the commercial request',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 'Acme Corp',
    description: 'Name of the client',
  })
  @Column({ type: 'varchar', length: 150 })
  client: string;

  @ApiProperty({
    example: 'Request for quotation for corporate cloud services',
    description: 'Reason and details of the commercial request',
  })
  @Column({ type: 'text' })
  description: string;

  @ApiProperty({
    example: 'advisor_john',
    description: 'Identifier or name of the assigned responsible advisor',
  })
  @Column({ type: 'varchar', length: 100 })
  advisor: string;

  @ApiProperty({
    enum: RequestStatus,
    example: RequestStatus.PENDING,
    description: 'Current status of the request (PENDING, IN_PROGRESS, RESOLVED)',
  })
  @Column({
    type: 'varchar',
    length: 50,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @ApiProperty({
    example: '2026-10-09T14:30:00.000Z',
    description: 'Date and time of request creation',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2026-10-09T14:35:00.000Z',
    description: 'Date and time of last update',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
