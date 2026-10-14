import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Request } from './request.entity.js';

export enum EventoTipo {
  CREACION = 'CREACION',
  ASIGNACION = 'ASIGNACION',
  ESTADO = 'ESTADO',
}

@Entity({ name: 'solicitud_historial' })
export class SolicitudHistorial {
  @ApiProperty({
    example: 1,
    description: 'Identificador único del evento en el historial de auditoría',
  })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 15,
    description: 'Identificador de la solicitud relacionada',
  })
  @Index()
  @Column({ type: 'integer' })
  solicitudId: number;

  @ManyToOne(() => Request, (request) => request.historial, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'solicitudId' })
  solicitud: Request;

  @ApiProperty({
    enum: EventoTipo,
    example: EventoTipo.CREACION,
    description: 'Tipo de evento registrado (CREACION, ASIGNACION, ESTADO)',
  })
  @Column({ type: 'varchar', length: 50 })
  tipoEvento: string;

  @ApiPropertyOptional({
    example: 'PENDIENTE',
    description: 'Valor previo al cambio, o null si es creación inicial',
  })
  @Column({ type: 'varchar', length: 255, nullable: true })
  valorAnterior: string | null;

  @ApiProperty({
    example: 'EN_GESTION',
    description: 'Nuevo valor aplicado tras la operación',
  })
  @Column({ type: 'varchar', length: 255 })
  valorNuevo: string;

  @ApiProperty({
    example: 'supervisor',
    description: 'Usuario que ejecutó la acción de auditoría',
  })
  @Column({ type: 'varchar', length: 100 })
  usuarioActor: string;

  @ApiProperty({
    example: '2026-10-13T12:00:00.000Z',
    description: 'Fecha y hora en que ocurrió el evento de auditoría',
  })
  @Index()
  @CreateDateColumn()
  fechaEvento: Date;
}

export const RequestHistory = SolicitudHistorial;
