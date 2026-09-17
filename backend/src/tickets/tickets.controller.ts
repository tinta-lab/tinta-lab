import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiCreatedResponse,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TicketsService } from './tickets.service';
import { ClientsService } from '../clients/clients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { TICKET_MANAGE_ROLES } from '../auth/role-groups';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateClientTicketDto } from './dto/create-client-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { CreateStaffTicketMessageDto } from './dto/create-staff-ticket-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { FindTicketsQueryDto } from './dto/find-tickets-query.dto';
import { PublicTicketViewDto } from './dto/public-ticket-view.dto';
import {
  StaffTicketViewDto,
  toStaffTicketView,
} from './dto/staff-ticket-view.dto';
import {
  AdminTicketReadViewDto,
  toAdminTicketReadView,
} from './dto/admin-ticket-read-view.dto';
import { ClientTicketMessageViewDto } from './dto/client-ticket-view.dto';
import { StaffTicketMessageViewDto } from './dto/staff-ticket-message-view.dto';

// POST :id/messages is role-aware (see addMessage below) — the request body
// shape differs by role (CLIENT never gets an `internal` field; STAFF must
// supply it), so it can't be validated by a single @Body() DTO type the way
// every other route here is. This mirrors main.ts's global ValidationPipe
// options exactly, applied to whichever DTO class matches the caller's role.
async function validateDto<T extends object>(
  cls: new () => T,
  body: unknown,
): Promise<T> {
  const instance = plainToInstance(cls, body ?? {});
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length) throw new BadRequestException(errors);
  return instance;
}

// findAll/findOne/updateStatus return a role-dependent union
// (StaffTicketViewDto for SUPPORT/SALES, AdminTicketReadViewDto for ADMIN) —
// the Swagger CLI plugin's static analysis doesn't expand union return
// types, so one half silently drops out of the generated schema unless
// forced into the component registry. See servers.controller.ts for the
// same pattern.
@ApiExtraModels(
  StaffTicketViewDto,
  AdminTicketReadViewDto,
  ClientTicketMessageViewDto,
  StaffTicketMessageViewDto,
)
@Controller('tickets')
export class TicketsController {
  constructor(
    private ticketsService: TicketsService,
    private clientsService: ClientsService,
  ) {}

  // 3 tickets per hour per IP — prevents contact form spam
  @Post('public')
  @Throttle({ default: { ttl: 3_600_000, limit: 3 } })
  createPublic(@Body() dto: CreateTicketDto): Promise<PublicTicketViewDto> {
    return this.ticketsService.create(dto);
  }

  // CLIENT creates a support ticket for one of their own homes/servers.
  // name/email are derived from the authenticated user, never from the body.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  async createForClient(
    @Body() dto: CreateClientTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.findByUserId(user.id);
    return this.ticketsService.createForClient(
      client.id,
      {
        firstName: client.user.firstName,
        lastName: client.user.lastName,
        email: user.email,
      },
      dto,
    );
  }

  // CLIENT sees only their own tickets — clientId comes from the resolved
  // client record, never from a query param.
  @Get('mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  async findAllForClient(@CurrentUser() user: AuthenticatedUser) {
    const client = await this.clientsService.findByUserId(user.id);
    return this.ticketsService.findAllForClient(client.id);
  }

  @Get('mine/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT)
  async findOneForClient(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const client = await this.clientsService.findByUserId(user.id);
    return this.ticketsService.findByIdForClient(id, client.id);
  }

  // Single route, role-aware: CLIENT replies on their own ticket (never
  // internal — CreateTicketMessageDto has no such field, and whitelist +
  // forbidNonWhitelisted rejects one if sent); STAFF replies or leaves an
  // internal note on any ticket (internal is required, not defaulted).
  // authorId/authorRole always come from the JWT-resolved user, never body.
  @Post(':id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.SUPPORT, UserRole.ADMIN, UserRole.SALES)
  @ApiCreatedResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ClientTicketMessageViewDto) },
        { $ref: getSchemaPath(StaffTicketMessageViewDto) },
      ],
    },
  })
  async addMessage(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientTicketMessageViewDto | StaffTicketMessageViewDto> {
    if (user.role === UserRole.CLIENT) {
      const dto = await validateDto(CreateTicketMessageDto, body);
      const client = await this.clientsService.findByUserId(user.id);
      return this.ticketsService.addClientMessage(
        id,
        client.id,
        user.id,
        { firstName: client.user.firstName, lastName: client.user.lastName },
        dto.message,
      );
    }

    const dto = await validateDto(CreateStaffTicketMessageDto, body);
    return this.ticketsService.addStaffMessage(
      id,
      { id: user.id, role: user.role },
      dto.message,
      dto.internal,
    );
  }

  // STAFF-only full conversation (internal notes included). CLIENT gets the
  // client-visible subset embedded in GET /tickets/mine/:id instead — this
  // route is never reachable by CLIENT (RolesGuard rejects it before the
  // handler runs).
  @Get(':id/messages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SUPPORT)
  findMessagesForStaff(
    @Param('id') id: string,
  ): Promise<StaffTicketMessageViewDto[]> {
    return this.ticketsService.findMessagesForStaff(id);
  }

  // SALES/SUPPORT get StaffTicketViewDto (never the raw Server's Cloudflare
  // infra secrets). ADMIN gets AdminTicketReadViewDto — not the raw entity;
  // see admin-ticket-read-view.dto.ts for why "ADMIN is trusted" isn't a
  // reason to skip an explicit contract (P1.4-B/D).
  // @ApiExtraModels alone only registers a schema in the component registry
  // — it does NOT wire a role-branched union return type into this specific
  // operation's response (still resolves to `Record<string, never>` without
  // an explicit oneOf, same lesson as servers.controller.ts).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SUPPORT)
  @ApiOkResponse({
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(StaffTicketViewDto) },
          { $ref: getSchemaPath(AdminTicketReadViewDto) },
        ],
      },
    },
  })
  async findAll(
    @Query() query: FindTicketsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StaffTicketViewDto[] | AdminTicketReadViewDto[]> {
    const tickets = await this.ticketsService.findAll(
      query.status,
      query.clientId,
      query.skip,
      query.take,
    );
    if (user.role === UserRole.ADMIN) {
      return tickets.map(toAdminTicketReadView);
    }
    return tickets.map(toStaffTicketView);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SALES, UserRole.SUPPORT)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaffTicketViewDto) },
        { $ref: getSchemaPath(AdminTicketReadViewDto) },
      ],
    },
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StaffTicketViewDto | AdminTicketReadViewDto> {
    const ticket = await this.ticketsService.findById(id);
    if (user.role === UserRole.ADMIN) return toAdminTicketReadView(ticket);
    return toStaffTicketView(ticket);
  }

  // SUPPORT can update status as of Phase 0 (was ADMIN/SALES only) — see
  // PHASE0_PHASE1_SPEC.md Phase 0.1. Transitions are constrained by
  // ticket-status.transitions.ts regardless of role; every real transition
  // (not a same-status no-op) is recorded as an internal TicketMessage.
  // Response uses the same role-mapped view as findAll()/findOne() above —
  // support/tickets/[id]/page.tsx replaces its whole ticket state with this
  // response (`setTicket(updated)`), so it must carry the same shape as GET.
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TICKET_MANAGE_ROLES)
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaffTicketViewDto) },
        { $ref: getSchemaPath(AdminTicketReadViewDto) },
      ],
    },
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StaffTicketViewDto | AdminTicketReadViewDto> {
    const ticket = await this.ticketsService.updateStatus(
      id,
      dto.status,
      { id: user.id, role: user.role },
      dto.assignedToId,
      dto.internalNotes,
    );
    if (user.role === UserRole.ADMIN) return toAdminTicketReadView(ticket);
    return toStaffTicketView(ticket);
  }
}
