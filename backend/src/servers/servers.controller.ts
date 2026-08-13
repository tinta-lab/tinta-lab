import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ServersService } from './servers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ClientsService } from '../clients/clients.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';

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
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() pagination: PaginationDto) {
    if (user.role === UserRole.SUPPORT) {
      return this.serversService.findAccessibleForSupport();
    }
    return this.serversService.findAll(pagination.skip, pagination.take);
  }

  @Get('my')
  @Roles(UserRole.CLIENT)
  async getMyServers(@CurrentUser() user: AuthenticatedUser) {
    const client = await this.clientsService.findByUserId(user.id);
    return this.serversService.findByClientId(client.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const server = await this.serversService.findById(id);
    // Support may only access details of servers with active access
    if (user.role === UserRole.SUPPORT && !server.accessEnabled) {
      throw new ForbiddenException(
        'Access to this server is not currently granted',
      );
    }
    if (user.role === UserRole.SUPPORT) {
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

  // CLIENT was previously able to POST a heartbeat for ANY server id, not
  // just their own (IDOR — no ownership check, and the untyped inline body
  // type meant the global ValidationPipe's whitelist/forbidNonWhitelisted
  // never actually ran, since it only validates against a real DTO class).
  // Mirrors the ownership check already used in AccessController for the
  // same CLIENT-role pattern.
  @Post(':id/heartbeat')
  @HttpCode(200)
  @Roles(UserRole.ADMIN, UserRole.SUPPORT, UserRole.CLIENT)
  async heartbeat(
    @Param('id') id: string,
    @Body() dto: HeartbeatDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (user.role === UserRole.CLIENT) {
      const client = await this.clientsService.findByUserId(user.id);
      const ownServers = await this.serversService.findByClientId(client.id);
      if (!ownServers.some((s) => s.id === id)) {
        throw new ForbiddenException('Server does not belong to this account');
      }
    }
    return this.serversService.heartbeat(id, dto.haVersion);
  }
}
