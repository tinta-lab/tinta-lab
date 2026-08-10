import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  SUPPORT = 'support',
  SALES = 'sales',
  CLIENT = 'client',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  // Any JWT with iat before this timestamp is rejected by JwtStrategy —
  // set on every password change (self-service or admin reset) so a
  // compromised/leaked token can't outlive the password it was issued under.
  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
