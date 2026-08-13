import {
  Controller,
  Post,
  Delete,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { AccessService } from './access.service';
import { GrantAccessDto } from './dto/grant-access.dto';
import { ClientsService } from '../clients/clients.service';
import { ServersService } from '../servers/servers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

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
    return this.accessService.grantAccess(serverId, user.id, dto);
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
  ) {
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

  // CLIENT sees their own access history
  @Get('my-logs')
  @Roles(UserRole.CLIENT)
  async getMyLogs(@CurrentUser() user: AuthenticatedUser) {
    const client = await this.clientsService.findByUserId(user.id);
    return this.accessService.getLogsForClient(client.id);
  }

  // ADMIN: put/lift a litigation/incident hold — excludes the log from GDPR purge
  @Patch('logs/:id/hold')
  @Roles(UserRole.ADMIN)
  setRetentionHold(@Param('id') id: string, @Body('hold') hold: boolean) {
    return this.accessService.setRetentionHold(id, !!hold);
  }

  // ADMIN: technical audit trail for one session (hash-chained events)
  @Get('audit/:accessLogId')
  @Roles(UserRole.ADMIN)
  getAuditTrail(@Param('accessLogId') accessLogId: string) {
    return this.accessService.getAuditTrail(accessLogId);
  }

  // ADMIN: verify the whole audit ledger hasn't been tampered with
  @Get('audit-verify')
  @Roles(UserRole.ADMIN)
  verifyAuditChain() {
    return this.accessService.verifyAuditChain();
  }
}
