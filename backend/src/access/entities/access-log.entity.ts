import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Server } from '../../servers/entities/server.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { AccessReason } from '../enums/access-reason.enum';

@Entity('access_logs')
export class AccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Indexed — server.id is filtered on directly in getLogsForServer /
  // getActiveAccessForServer, and Postgres doesn't auto-index FK columns
  // the way MySQL does. See sql/005_access_logs_fk_indexes.sql.
  @Index()
  @ManyToOne(() => Server)
  @JoinColumn()
  server: Server;

  // Indexed — filterable dimension on GET /access/logs (?staffId= filters
  // audit_events.actorUserId, but "who opened the session" is grantedBy).
  // See sql/010_access_logs_browser_indexes.sql.
  @Index()
  @ManyToOne(() => User)
  @JoinColumn()
  grantedBy: User;

  // Indexed — findStaffActivity's raw query filters `WHERE "accessedById" =
  // ANY($1)` directly. See sql/005_access_logs_fk_indexes.sql.
  @Index()
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  accessedBy: User;

  // LEGACY — free-text reason. New grants no longer write this column (see
  // reasonCode/reasonDetails below); kept only so old rows keep displaying.
  @Column({ nullable: true, type: 'text' })
  reason: string | null;

  // Why this session was opened — closed set. Shown to client + support.
  @Column({ nullable: true, type: 'varchar', length: 32 })
  reasonCode: AccessReason | null;

  // Free text, only ever set when reasonCode === OTHER (validated on input).
  @Column({ nullable: true, type: 'varchar', length: 280 })
  reasonDetails: string | null;

  // Optional link to a formal support ticket this session addresses.
  // Indexed — filtered directly on GET /access/logs (?ticketId=), and it's
  // the join target for the STAFF ticket-scope subquery. See
  // sql/010_access_logs_browser_indexes.sql.
  @Index()
  @ManyToOne(() => Ticket, { nullable: true })
  @JoinColumn()
  ticket: Ticket | null;

  // Litigation/incident hold — excludes this record from GDPR retention purge
  @Column({ default: false })
  retentionHold: boolean;

  @Column({ type: 'timestamp' })
  grantedAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  connectedAt: Date;

  @Column({ nullable: true, type: 'timestamp' })
  revokedAt: Date;

  @Column({ default: false })
  isRevoked: boolean;

  @Column({ nullable: true, type: 'text' })
  supportPassword: string;

  @Column({ nullable: true, type: 'simple-json' })
  activityLog: string[] | null;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  // Indexed — date-range filter on GET /access/logs (?dateFrom=/?dateTo=
  // filters audit_events.createdAt, but the session's own createdAt is
  // useful for the same kind of range query on access_logs directly).
  // See sql/010_access_logs_browser_indexes.sql.
  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
