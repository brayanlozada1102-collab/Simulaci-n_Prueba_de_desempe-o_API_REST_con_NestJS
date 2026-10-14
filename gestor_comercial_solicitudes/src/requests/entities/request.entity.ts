import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SolicitudHistorial } from './solicitud-historial.entity.js';

export enum RequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export enum EstadoSolicitud {
  PENDIENTE = 'PENDIENTE',
  EN_GESTION = 'EN_GESTION',
  RESUELTA = 'RESUELTA',
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

  @ApiPropertyOptional({
    example: 'advisor_john',
    description: 'Identifier or username of the assigned advisor (null if unassigned)',
  })
  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  advisor: string | null;

  @ApiProperty({
    enum: RequestStatus,
    example: RequestStatus.PENDING,
    description: 'Current status of the request (PENDING, IN_PROGRESS, RESOLVED)',
  })
  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    default: RequestStatus.PENDING,
  })
  status: RequestStatus;

  @ApiProperty({
    example: 1,
    description: 'Optimistic locking concurrency version',
  })
  @Column({
    type: 'integer',
    default: 1,
  })
  version: number;

  @ApiProperty({
    example: '2026-10-09T14:30:00.000Z',
    description: 'Date and time of request creation',
  })
  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    example: '2026-10-09T14:35:00.000Z',
    description: 'Date and time of last update',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => SolicitudHistorial, (historial) => historial.solicitud)
  historial: SolicitudHistorial[];

  toJSON() {
    return {
      id: this.id,
      client: this.client,
      cliente: this.client,
      description: this.description,
      descripcion: this.description,
      advisor: this.advisor,
      asesor: this.advisor,
      status: this.status,
      estado: this.status,
      version: this.version,
      createdAt: this.createdAt,
      creadaEn: this.createdAt,
      updatedAt: this.updatedAt,
      actualizadaEn: this.updatedAt,
      ...(this.historial ? { historial: this.historial } : {}),
    };
  }
}

export const Solicitud = Request;
export type Solicitud = Request;
