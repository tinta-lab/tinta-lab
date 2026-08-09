import { Controller, Post, Get, Body, Param, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TintaCoreService } from './tinta-core.service';
import { GoldenTemplateService } from './golden-template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ExecuteCommandDto } from './dto/execute-command.dto';

@Controller('tinta-core')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TintaCoreController {
  constructor(
    private readonly coreService: TintaCoreService,
    private readonly templateService: GoldenTemplateService,
  ) {}

  // Admin: provision agent for a client → returns JWT token
  @Post('provision/:clientId')
  @Roles(UserRole.ADMIN)
  async provision(@Param('clientId') clientId: string) {
    return this.coreService.provisionAgent(clientId);
  }

  // Admin: get all agent sessions
  @Get('sessions')
  @Roles(UserRole.ADMIN)
  async getSessions() {
    return this.coreService.getAllSessions();
  }

  // Admin: get connected agents
  @Get('connected')
  @Roles(UserRole.ADMIN)
  async getConnected() {
    const ids = this.coreService.getConnectedAgents();
    return { count: ids.length, clientIds: ids };
  }

  // Admin: trigger agent self-update via HA Supervisor
  @Post('update/:clientId')
  @Roles(UserRole.ADMIN)
  async updateAgent(
    @Param('clientId') clientId: string,
    @Query('version') version: string,
  ) {
    return this.coreService.updateAgent(clientId, version ?? '');
  }

  @Post('execute/:clientId')
  @Roles(UserRole.ADMIN)
  async execute(
    @Param('clientId') clientId: string,
    @Body() dto: ExecuteCommandDto,
  ) {
    return this.coreService.executeAction(clientId, dto as any);
  }

  @Post('template/:clientId/:slug')
  @Roles(UserRole.ADMIN)
  async applyTemplate(
    @Param('clientId') clientId: string,
    @Param('slug') slug: string,
  ) {
    return this.coreService.applyGoldenTemplate(clientId, slug);
  }

  @Get('templates')
  @Roles(UserRole.ADMIN)
  async getTemplates() {
    return this.templateService.findAll();
  }

  @Post('templates')
  @Roles(UserRole.ADMIN)
  async createTemplate(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }
}
