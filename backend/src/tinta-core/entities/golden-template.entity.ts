import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('golden_templates')
export class GoldenTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  // automation: trigger + action как JSONB
  @Column({ type: 'jsonb' })
  automation: Record<string, any>;

  // Список типов устройств, которые нужны для шаблона
  @Column({ type: 'jsonb', default: '[]' })
  requiredEntities: string[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
