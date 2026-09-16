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
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
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
import { toSupportServerView, SupportServerViewDto } from './dto/support-server-view.dto';
import { AdminServerViewDto, toAdminServerView } from './dto/admin-server-view.dto';
import {
  AdminServerReadViewDto,
  toAdminServerReadView,
} from './dto/admin-server-read-view.dto';

// findAll/findOne return a role-dependent union (SupportServerViewDto for
// SUPPORT, AdminServerReadViewDto for ADMIN) — the Swagger CLI plugin's
// static analysis doesn't expand union return types, so one half of the
// union silently drops out of the generated schema despite being a real,
// reachable response shape. @ApiExtraModels forces both into the component
// registry.
@ApiExtraModels(SupportServerViewDto, AdminServerReadViewDto)
@Controller('servers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServersController {
  constructor(
    private serversService: ServersService,
    private clientsService: ClientsService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateServerDto): Promise<AdminServerViewDto> {
    return toAdminServerView(await this.serversService.create(dto));
  }

  // @ApiExtraModels alone only registers a schema in the component registry
  // — it does NOT wire a role-branched union return type into this specific
  // operation's response, which otherwise still resolves to an untyped
  // `Record<string, never>` in OpenAPI despite the real TS return type being
  // a proper union. An explicit oneOf is required for the operation itself.
  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(SupportServerViewDto) },
          { $ref: getSchemaPath(AdminServerReadViewDto) },
        ],
      },
    },
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ): Promise<SupportServerViewDto[] | AdminServerReadViewDto[]> {
    if (user.role === UserRole.SUPPORT) {
      return this.serversService.findAccessibleForSupport();
    }
    const servers = await this.serversService.findAll(
      pagination.skip,
      pagination.take,
    );
    return servers.map(toAdminServerReadView);
  }

  @Get('my')
  @Roles(UserRole.CLIENT)
  async getMyServers(@CurrentUser() user: AuthenticatedUser) {
    const client = await this.clientsService.findByUserId(user.id);
    return this.serversService.findMyServers(client.id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPPORT)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(SupportServerViewDto) },
        { $ref: getSchemaPath(AdminServerReadViewDto) },
      ],
    },
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SupportServerViewDto | AdminServerReadViewDto> {
    const server = await this.serversService.findById(id);
    // Support may only access details of servers with active access
    if (user.role === UserRole.SUPPORT && !server.accessEnabled) {
      throw new ForbiddenException(
        'Access to this server is not currently granted',
      );
    }
    if (user.role === UserRole.SUPPORT) {
      return toSupportServerView(server);
    }
    return toAdminServerReadView(server);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateServerDto): Promise<AdminServerViewDto> {
    return toAdminServerView(await this.serversService.update(id, dto));
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
