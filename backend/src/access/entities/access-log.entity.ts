import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Server } from '../../servers/entities/server.entity';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { AccessReason } from '../enums/access-reason.enum';

@Entity('access_logs')
export class AccessLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Server)
  @JoinColumn()
  server: Server;

  @ManyToOne(() => User)
  @JoinColumn()
  grantedBy: User;

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

  // Optional link to a formal support ticket this session addresses
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

  @CreateDateColumn()
  createdAt: Date;
}
