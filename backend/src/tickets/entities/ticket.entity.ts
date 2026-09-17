import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';
import { Client } from '../../clients/entities/client.entity';
import { Server } from '../../servers/entities/server.entity';
import { TicketMessage } from './ticket-message.entity';

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
  @ApiProperty({ enum: TicketType, enumName: 'TicketType' })
  type: TicketType;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.NEW })
  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus' })
  status: TicketStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  assignedTo: User;

  // Set only for tickets created through the authenticated client-portal
  // flow (POST /tickets). Public leads from /tickets/public (POST) leave
  // this null — see 008_client_tickets.sql.
  @ManyToOne(() => Client, { nullable: true })
  @JoinColumn()
  client: Client | null;

  // The home/server this ticket concerns — required alongside `client` for
  // portal tickets, null for anonymous leads that predate server selection.
  @ManyToOne(() => Server, { nullable: true })
  @JoinColumn()
  server: Server | null;

  @Column({ nullable: true, type: 'text' })
  internalNotes: string;

  @OneToMany(() => TicketMessage, (message) => message.ticket)
  messages: TicketMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
