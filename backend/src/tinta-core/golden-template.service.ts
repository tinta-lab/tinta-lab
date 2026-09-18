import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GoldenTemplate } from './entities/golden-template.entity';
import { AgentSession } from './entities/agent-session.entity';
import {
  GoldenTemplateViewDto,
  toGoldenTemplateView,
} from './dto/golden-template-view.dto';

@Injectable()
export class GoldenTemplateService {
  private readonly logger = new Logger(GoldenTemplateService.name);

  constructor(
    @InjectRepository(GoldenTemplate)
    private readonly templateRepo: Repository<GoldenTemplate>,
    @InjectRepository(AgentSession)
    private readonly sessionRepo: Repository<AgentSession>,
  ) {}

  async findAll(): Promise<GoldenTemplateViewDto[]> {
    const templates = await this.templateRepo.find({
      where: { isActive: true },
    });
    return templates.map(toGoldenTemplateView);
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
  }): Promise<GoldenTemplateViewDto> {
    const template = this.templateRepo.create(data as any);
    const saved = (await this.templateRepo.save(
      template,
    )) as unknown as GoldenTemplate;
    return toGoldenTemplateView(saved);
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
