import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type NotificationStatus = 'pending' | 'processing' | 'sent' | 'failed';

// A notification waiting for (or done with) delivery — see
// sql/013_notification_outbox.sql and NotificationDispatcher.
@Entity('notification_outbox')
@Index('IDX_notification_outbox_due', ['priority', 'nextAttemptAt'], {
  where: `status IN ('pending', 'processing')`,
})
export class NotificationOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  eventType: string;

  // 0 critical, 1 high, 2 normal, 3 low — notification-policy.ts
  @Column({ type: 'smallint' })
  priority: number;

  // What the template needs to render the message. No secrets.
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: NotificationStatus;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'integer' })
  maxAttempts: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastErrorCode: string | null;
}
