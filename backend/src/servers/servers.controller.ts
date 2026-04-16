import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, HttpCode } from '@nestjs/common';
import { ServersService } from './servers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ClientsService } from '../clients/clients.service';

@Controller('servers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServersController {
  constructor(
    private serversService: ServersService,
    private clientsService: ClientsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() body: any) {
    return this.serversService.create(body);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  findAll() {
    return this.serversService.findAll();
  }

  @Get('my')
  @Roles(UserRole.CLIENT)
  async getMyServers(@Request() req: any) {
    const client = await this.clientsService.findByUserId(req.user.id);
    return this.serversService.findByClientId(client.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  findOne(@Param('id') id: string) {
    return this.serversService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.serversService.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.serversService.delete(id);
  }

  // Called by HA server to report it's alive
  @Post(':id/heartbeat')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.CLIENT)
  heartbeat(@Param('id') id: string, @Body() body: { haVersion?: string }) {
    return this.serversService.heartbeat(id, body.haVersion);
  }
}
