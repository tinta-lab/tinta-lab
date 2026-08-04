import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TicketStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  WAITING_CLIENT = 'waiting_client',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketType {
  INSTALLATION = 'installation',
  SUPPORT = 'support',
  SALES = 'sales',
  OTHER = 'other',
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'enum', enum: TicketType, default: TicketType.OTHER })
  type: TicketType;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.NEW })
  status: TicketStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  assignedTo: User;

  @Column({ nullable: true, type: 'text' })
  internalNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
