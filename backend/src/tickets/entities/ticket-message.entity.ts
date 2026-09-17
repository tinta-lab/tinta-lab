import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User, UserRole } from '../../users/entities/user.entity';
import { Ticket } from './ticket.entity';

@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Indexed — findByIdForClient and the (future) staff thread view both
  // filter WHERE "ticketId" = ... directly. Postgres doesn't auto-index FK
  // columns the way MySQL does — see sql/005_access_logs_fk_indexes.sql.
  @Index()
  @ManyToOne(() => Ticket, (ticket) => ticket.messages)
  @JoinColumn()
  ticket: Ticket;

  // Indexed — the Access Logs STAFF scope subquery filters WHERE "authorId"
  // = ... directly (SELECT DISTINCT ticketId ... WHERE authorId = ?). See
  // sql/010_access_logs_browser_indexes.sql.
  @Index()
  @ManyToOne(() => User)
  @JoinColumn()
  author: User;

  // Denormalized from author.role at write time so a message's byline stays
  // stable even if the author's role changes later, and so the client-facing
  // query can tell client vs. staff messages apart without joining users.
  @Column({ type: 'enum', enum: UserRole })
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  authorRole: UserRole;

  @Column({ type: 'text' })
  message: string;

  // Never visible to CLIENT — see TicketsService.findByIdForClient, which
  // filters internal = false. Only staff-side endpoints may set this true;
  // the client-facing DTO doesn't expose this field at all, so a CLIENT
  // request can't set it regardless of what the request body contains.
  @Column({ default: false })
  internal: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
