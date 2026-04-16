import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoldenTemplate } from './entities/golden-template.entity';
import { AgentSession } from './entities/agent-session.entity';

@Injectable()
export class GoldenTemplateService {
  private readonly logger = new Logger(GoldenTemplateService.name);

  constructor(
    @InjectRepository(GoldenTemplate)
    private readonly templateRepo: Repository<GoldenTemplate>,
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
  ) {}

  async findAll(): Promise<GoldenTemplate[]> {
    return this.templateRepo.find({ where: { isActive: true } });
  }

  async findBySlug(slug: string): Promise<GoldenTemplate> {
    const t = await this.templateRepo.findOne({ where: { slug } });
    if (!t) throw new NotFoundException(`Template ${slug} not found`);
    return t;
  }

  async create(data: {
    slug: string;
    name: string;
    description?: string;
    automation: Record<string, any>;
    requiredEntities?: string[];
  }): Promise<GoldenTemplate> {
    const template = this.templateRepo.create(data as any);
    return this.templateRepo.save(template) as unknown as GoldenTemplate;
  }

  // Идемпотентное применение шаблона — отправляет команду агенту
  async markApplied(clientId: string, templateSlug: string): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { clientId } });
    if (!session) return;
    if (!session.appliedTemplates.includes(templateSlug)) {
      session.appliedTemplates = [...session.appliedTemplates, templateSlug];
      await this.sessionRepo.save(session);
    }
    this.logger.log(`Template ${templateSlug} applied for client ${clientId}`);
  }

  isApplied(session: AgentSession, slug: string): boolean {
    return session.appliedTemplates.includes(slug);
  }
}
