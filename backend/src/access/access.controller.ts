import { Controller, Post, Delete, Get, Param, UseGuards, Request } from '@nestjs/common';
import { AccessService } from './access.service';
import { ClientsService } from '../clients/clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessController {
  constructor(
    private accessService: AccessService,
    private clientsService: ClientsService,
  ) {}

  // CLIENT grants access to their own server
  @Post('grant/:serverId')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  grantAccess(@Param('serverId') serverId: string, @Request() req: any) {
    return this.accessService.grantAccess(serverId, req.user.id);
  }

  // CLIENT or ADMIN can revoke; SUPPORT cannot grant or revoke
  @Delete('revoke/:serverId')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  revokeAccess(@Param('serverId') serverId: string) {
    return this.accessService.revokeAccess(serverId);
  }

  // SUPPORT records their connection (called before opening HA URL)
  @Post('connect/:serverId')
  @Roles(UserRole.SUPPORT, UserRole.ADMIN)
  recordConnection(@Param('serverId') serverId: string, @Request() req: any) {
    return this.accessService.recordConnection(serverId, req.user.id);
  }

  // Admin/Support see logs for any server
  @Get('logs/:serverId')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  getLogs(@Param('serverId') serverId: string) {
    return this.accessService.getLogsForServer(serverId);
  }

  // Client sees their own access history
  @Get('my-logs')
  @Roles(UserRole.CLIENT)
  async getMyLogs(@Request() req: any) {
    const client = await this.clientsService.findByUserId(req.user.id);
    return this.accessService.getLogsForClient(client.id);
  }
}
