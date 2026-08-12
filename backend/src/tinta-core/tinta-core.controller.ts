import { Controller, Post, Get, Body, Param, UseGuards, Query, Optional } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TintaCoreService } from './tinta-core.service';
import { GoldenTemplateService } from './golden-template.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { ExecuteCommandDto } from './dto/execute-command.dto';
import { CloudflareService } from '../cloudflare/cloudflare.service';
import { ServersGateway } from '../servers/servers.gateway';

@Controller('tinta-core')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TintaCoreController {
  constructor(
    private readonly coreService: TintaCoreService,
    private readonly templateService: GoldenTemplateService,
    private readonly serversGateway: ServersGateway,
    @Optional() private readonly cloudflare: CloudflareService,
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

  // Admin: live diagnostics from the agent (haConnected right now, not the
  // stale startup snapshot) — round-trips over the agent's WebSocket, so
  // this can take a few seconds and may time out if the agent is stuck.
  @Get('diagnostics/:clientId')
  @Roles(UserRole.ADMIN)
  async getDiagnostics(@Param('clientId') clientId: string) {
    return this.coreService.getDiagnostics(clientId);
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
    return this.coreService.executeAction(clientId, dto);
  }

  @Post('template/:clientId/:slug')
  @Roles(UserRole.ADMIN)
  async applyTemplate(
    @Param('clientId') clientId: string,
    @Param('slug') slug: string,
  ) {
    return this.coreService.applyGoldenTemplate(clientId, slug);
  }

  // One-time setup: create the reusable Cloudflare Access policy and return its ID
  // Store the returned policyId as CLOUDFLARE_ACCESS_POLICY_ID in backend/.env
  @Post('cloudflare/ensure-policy')
  @Roles(UserRole.ADMIN)
  async ensureCloudflarePolicy() {
    if (!this.cloudflare?.isEnabled) {
      return { error: 'Cloudflare not configured' };
    }
    const policyId = await this.cloudflare.ensureReusablePolicy();
    return { policyId };
  }

  // Returns user IDs of support/sales/admin currently connected via dashboard WebSocket
  @Get('online-users')
  @Roles(UserRole.ADMIN)
  getOnlineUsers() {
    return { userIds: [...this.serversGateway.getConnectedUserIds()] };
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
