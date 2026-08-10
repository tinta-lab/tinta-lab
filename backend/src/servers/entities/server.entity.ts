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

export enum ServerStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown',
}

@Entity('servers')
export class Server {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client)
  @JoinColumn()
  client: Client;

  @Column()
  name: string;

  @Column({ unique: true })
  subdomain: string;

  // Random 6-char ID used in public hostname: hub-{hubId}.tinta-lab.de
  // Never contains client name — prevents enumeration of client hostnames
  @Column({ nullable: true, unique: true, type: 'varchar', length: 8 })
  hubId: string | null;

  @Column({ nullable: true })
  tunnelId: string;

  // Cloudflare Access Application ID — for cleanup on server deletion
  @Column({ nullable: true, type: 'varchar' })
  cfAccessAppId: string | null;

  // Cloudflare tunnel token — used with: cloudflared tunnel run --token <tunnelToken>
  @Column({ nullable: true, type: 'text' })
  tunnelToken: string | null;

  // Cloudflare DNS record ID — for cleanup on server deletion
  @Column({ nullable: true, type: 'varchar' })
  cfDnsRecordId: string | null;

  @Column({ type: 'enum', enum: ServerStatus, default: ServerStatus.UNKNOWN })
  status: ServerStatus;

  @Column({ default: false })
  accessEnabled: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  accessExpiresAt: Date | null;

  @Column({ nullable: true, type: 'timestamp' })
  lastSeenAt: Date | null;

  @Column({ nullable: true, type: 'varchar' })
  haVersion: string | null;

  // Direct local URL for internal/testing access (e.g. http://192.168.2.206:8123)
  // In production this is replaced by the Cloudflare tunnel subdomain
  @Column({ nullable: true, type: 'varchar' })
  localUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
