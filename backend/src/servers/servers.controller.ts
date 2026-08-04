import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { ServersService } from './servers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ClientsService } from '../clients/clients.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';

@Controller('servers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServersController {
  constructor(
    private serversService: ServersService,
    private clientsService: ClientsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateServerDto) {
    return this.serversService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  findAll(@Request() req: any) {
    if (req.user.role === UserRole.SUPPORT) {
      return this.serversService.findAccessibleForSupport();
    }
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
  async findOne(@Param('id') id: string, @Request() req: any) {
    const server = await this.serversService.findById(id);
    // Support may only access details of servers with active access
    if (req.user.role === UserRole.SUPPORT && !server.accessEnabled) {
      throw new ForbiddenException(
        'Access to this server is not currently granted',
      );
    }
    if (req.user.role === UserRole.SUPPORT) {
      // Strip sensitive infra fields before returning to support
      const { localUrl, tunnelToken, tunnelId, cfDnsRecordId, ...safe } =
        server as any;
      return {
        ...safe,
        client: safe.client
          ? {
              id: safe.client.id,
              user: safe.client.user
                ? {
                    id: safe.client.user.id,
                    firstName: safe.client.user.firstName,
                    lastName: safe.client.user.lastName,
                  }
                : undefined,
            }
          : undefined,
      };
    }
    return server;
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateServerDto) {
    return this.serversService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  delete(@Param('id') id: string) {
    return this.serversService.delete(id);
  }

  @Post(':id/heartbeat')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.CLIENT)
  heartbeat(@Param('id') id: string, @Body() body: { haVersion?: string }) {
    return this.serversService.heartbeat(id, body.haVersion);
  }
}
