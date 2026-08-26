import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from '../../clients/entities/client.entity';

export enum AgentStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
}

@Entity('agent_sessions')
export class AgentSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client)
  @JoinColumn()
  client: Client;

  @Column({ unique: true })
  clientId: string;

  @Column({
    type: 'enum',
    enum: AgentStatus,
    default: AgentStatus.DISCONNECTED,
  })
  status: AgentStatus;

  // JWT токен агента (генерируется при провиженинге)
  @Column({ nullable: true, type: 'text' })
  agentToken: string | null;

  // Версия агента, отправленная при подключении
  @Column({ nullable: true, type: 'varchar' })
  agentVersion: string | null;

  // Версия Home Assistant на клиенте
  @Column({ nullable: true, type: 'varchar' })
  haVersion: string | null;

  // Применённые golden templates (массив slug)
  @Column({ type: 'jsonb', default: '[]' })
  appliedTemplates: string[];

  // Last metrics snapshot from agent
  @Column({ type: 'jsonb', nullable: true })
  metrics: {
    cpuPercent: number;
    memPercent: number;
    diskPercent: number;
    deviceCount: number;
    automationCount: number;
    uptimeSeconds: number;
  } | null;

  @Column({ nullable: true, type: 'timestamp' })
  lastConnectedAt: Date | null;

  @Column({ nullable: true, type: 'timestamp' })
  lastHeartbeatAt: Date | null;

  @Column({ nullable: true, type: 'timestamp' })
  lastTokenMismatchAt: Date | null;

  @Column({ nullable: true, type: 'varchar', unique: true })
  installToken: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  installTokenExpiresAt: Date | null;

  // § 356 Abs. 4 BGB: a consumer's right of withdrawal ends early only if
  // they explicitly requested the service start before the 14-day window
  // closes AND acknowledged they lose that right once we fully perform. This
  // timestamp is the durable record of that consent — recorded server-side,
  // before GET /install/:token reveals the agent token or install steps, so
  // "the client started installing" can't itself be read as the required
  // consent after the fact.
  @Column({ nullable: true, type: 'timestamp' })
  serviceStartConsentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
