import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Server } from '../../servers/entities/server.entity';

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

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
