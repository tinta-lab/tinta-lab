import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationOutbox } from './notification-outbox.entity';

export type AttemptOutcome = 'sent' | 'retry' | 'failed';

// One delivery attempt of an outbox notification — the history the Grafana
// panels chart (sql/013_notification_outbox.sql).
@Entity('notification_attempts')
export class NotificationAttempt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Index('IDX_notification_attempts_notificationId')
  @Column('uuid')
  notificationId: string;

  @ManyToOne(() => NotificationOutbox, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notificationId' })
  notification?: NotificationOutbox;

  @Column({ type: 'varchar', length: 64 })
  eventType: string;

  @Index('IDX_notification_attempts_attemptedAt')
  @CreateDateColumn({ type: 'timestamptz' })
  attemptedAt: Date;

  @Column({ type: 'varchar', length: 16 })
  outcome: AttemptOutcome;

  // HTTP calls to Telegram within this attempt (html, plain fallback, 429 retry)
  @Column({ type: 'integer' })
  httpAttempts: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  errorCode: string | null;

  @Column({ type: 'integer' })
  durationMs: number;
}
