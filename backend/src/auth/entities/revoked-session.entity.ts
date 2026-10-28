import {
  Entity,
  PrimaryColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

// A logged-out session. Every token carrying this `sid` is rejected — see
// SessionRevocationService and sql/012_revoked_sessions.sql.
@Entity('revoked_sessions')
export class RevokedSession {
  @PrimaryColumn('uuid')
  sessionId: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  revokedAt: Date;

  // Logout time + token TTL: no token of this session can be valid past it,
  // so the row can be deleted then.
  @Index('IDX_revoked_sessions_expiresAt')
  @Column({ type: 'timestamptz' })
  expiresAt: Date;
}
