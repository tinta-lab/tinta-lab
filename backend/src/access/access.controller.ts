import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AccessService } from './access.service';
import { GrantAccessDto } from './dto/grant-access.dto';
import { AccessLogsQueryDto } from './dto/access-logs-query.dto';
import {
  AuditTrailEventViewDto,
  AuditChainVerificationDto,
} from './dto/audit-trail-view.dto';
import { MyLogsQueryDto } from './dto/my-logs-query.dto';
import { AccessConnectResponseDto } from './dto/access-connect-response.dto';
import { AccessEventPageDto } from './dto/access-event-view.dto';
import { toAccessGrantView } from './dto/access-grant-view.dto';
import { ClientsService } from '../clients/clients.service';
import { ServersService } from '../servers/servers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  SECURITY_CENTER_ROLES,
  AUDIT_LEDGER_ADMIN_ROLES,
} from '../auth/role-groups';

@Controller('access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessController {
  constructor(
    private readonly accessService: AccessService,
    private readonly clientsService: ClientsService,
    private readonly serversService: ServersService,
  ) {}

  // CLIENT grants access to their own server (ownership enforced)
  // ADMIN can grant access to any server
  @Post('grant/:serverId')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  async grantAccess(
    @Param('serverId') serverId: string,
    @Body() dto: GrantAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.CLIENT) {
      await this.accessService.assertOwnership(serverId, user.id);
    }
    const log = await this.accessService.grantAccess(serverId, user.id, dto);
    return toAccessGrantView(log);
  }

  // CLIENT revokes access to their own server (ownership enforced)
  // ADMIN can revoke access to any server
  @Delete('revoke/:serverId')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  async revokeAccess(@Param('serverId') serverId: string, @CurrentUser() user: AuthenticatedUser) {
    if (user.role === UserRole.CLIENT) {
      await this.accessService.assertOwnership(serverId, user.id);
    }
    return this.accessService.revokeAccess(serverId, 'manual', user.id);
  }

  // SUPPORT records their connection and gets credentials.
  // Rejected with 409 if another support employee already claimed this session.
  @Post('connect/:serverId')
  @Roles(UserRole.SUPPORT, UserRole.ADMIN)
  async recordConnection(
    @Param('serverId') serverId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessConnectResponseDto> {
    return this.accessService.recordConnection(serverId, user.id);
  }

  // ADMIN sees access logs for any server.
  // SUPPORT only for servers with currently active access — mirrors the
  // restriction on GET /servers/:id so support can't browse history for
  // servers they were never granted into.
  @Get('logs/:serverId')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async getLogs(@Param('serverId') serverId: string, @CurrentUser() user: AuthenticatedUser) {
    if (user.role === UserRole.SUPPORT) {
      const server = await this.serversService.findById(serverId);
      if (!server.accessEnabled) {
        throw new ForbiddenException(
          'Access to this server is not currently granted',
        );
      }
    }
    return this.accessService.getLogsForServer(serverId);
  }

  // Event-level Access Logs browser (audit_events, not access_logs — see
  // AccessService.queryAuditEvents for why). ADMIN gets the unrestricted,
  // globally filterable view, including filtering *by* a staff member via
  // `staffId`. SUPPORT/SALES get the same shape but scoped server-side to
  // events on tickets they posted a message on — `staffId` is dropped
  // entirely for them, never honored as "browse someone else's activity".
  @Get('logs')
  @Roles(...SECURITY_CENTER_ROLES)
  async getAuditEvents(
    @Query() query: AccessLogsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AccessEventPageDto> {
    if (user.role === UserRole.ADMIN) {
      return this.accessService.queryAuditEvents(query);
    }
    const { staffId: _ignoredForStaff, ...staffQuery } = query;
    return this.accessService.queryAuditEvents(staffQuery, user.id);
  }

  // Session-level drill-down for one access_logs row — full lifecycle
  // fields plus its ordered audit_events chain. Named `sessions`, not
  // `logs/:id`, specifically to avoid colliding with GET /access/logs/:serverId
  // above (same path shape, different id space — serverId vs accessLogId).
  @Get('sessions/:accessLogId')
  @Roles(...SECURITY_CENTER_ROLES)
  async getAccessLogDetail(
    @Param('accessLogId') accessLogId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.ADMIN) {
      return this.accessService.getAccessLogDetail(accessLogId);
    }
    return this.accessService.getAccessLogDetail(accessLogId, user.id);
  }

  // CLIENT sees their own access history, optionally scoped to one ticket
  @Get('my-logs')
  @Roles(UserRole.CLIENT)
  async getMyLogs(
    @Query() query: MyLogsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.findByUserId(user.id);
    return this.accessService.getLogsForClient(client.id, query.ticketId);
  }

  // ADMIN: put/lift a litigation/incident hold — excludes the log from GDPR purge
  @Patch('logs/:id/hold')
  @Roles(UserRole.ADMIN)
  setRetentionHold(@Param('id') id: string, @Body('hold') hold: boolean) {
    return this.accessService.setRetentionHold(id, !!hold);
  }

  // ADMIN: technical audit trail for one session (hash-chained events)
  @Get('audit/:accessLogId')
  @Roles(...AUDIT_LEDGER_ADMIN_ROLES)
  getAuditTrail(
    @Param('accessLogId') accessLogId: string,
  ): Promise<AuditTrailEventViewDto[]> {
    return this.accessService.getAuditTrail(accessLogId);
  }

  // ADMIN: verify the whole audit ledger hasn't been tampered with
  @Get('audit-verify')
  @Roles(...AUDIT_LEDGER_ADMIN_ROLES)
  verifyAuditChain(): Promise<AuditChainVerificationDto> {
    return this.accessService.verifyAuditChain();
  }
}
