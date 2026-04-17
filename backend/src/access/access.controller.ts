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
    private readonly accessService: AccessService,
    private readonly clientsService: ClientsService,
  ) {}

  // CLIENT grants access to their own server (ownership enforced)
  // ADMIN can grant access to any server
  @Post('grant/:serverId')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  async grantAccess(@Param('serverId') serverId: string, @Request() req: any) {
    if (req.user.role === UserRole.CLIENT) {
      await this.accessService.assertOwnership(serverId, req.user.id);
    }
    return this.accessService.grantAccess(serverId, req.user.id);
  }

  // CLIENT revokes access to their own server (ownership enforced)
  // ADMIN can revoke access to any server
  @Delete('revoke/:serverId')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  async revokeAccess(@Param('serverId') serverId: string, @Request() req: any) {
    if (req.user.role === UserRole.CLIENT) {
      await this.accessService.assertOwnership(serverId, req.user.id);
    }
    return this.accessService.revokeAccess(serverId);
  }

  // SUPPORT records their connection and gets credentials
  @Post('connect/:serverId')
  @Roles(UserRole.SUPPORT, UserRole.ADMIN)
  async recordConnection(@Param('serverId') serverId: string, @Request() req: any) {
    await this.accessService.recordConnection(serverId, req.user.id);
    return this.accessService.getActiveAccessForServer(serverId);
  }

  // ADMIN/SUPPORT see access logs for any server
  @Get('logs/:serverId')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  getLogs(@Param('serverId') serverId: string) {
    return this.accessService.getLogsForServer(serverId);
  }

  // CLIENT sees their own access history
  @Get('my-logs')
  @Roles(UserRole.CLIENT)
  async getMyLogs(@Request() req: any) {
    const client = await this.clientsService.findByUserId(req.user.id);
    return this.accessService.getLogsForClient(client.id);
  }
}
