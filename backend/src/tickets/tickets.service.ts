import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus, TicketType } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { UserRole } from '../users/entities/user.entity';
import { ServersService } from '../servers/servers.service';
import { Server } from '../servers/entities/server.entity';
import { UsersService } from '../users/users.service';
import { isAllowedTicketStatusTransition } from './ticket-status.transitions';
import {
  ClientTicketDetailViewDto,
  ClientTicketMessageViewDto,
  ClientTicketViewDto,
  toClientTicketMessageView,
  toClientTicketView,
} from './dto/client-ticket-view.dto';
import {
  StaffTicketMessageViewDto,
  toStaffTicketMessageView,
} from './dto/staff-ticket-message-view.dto';
import { PublicTicketViewDto, toPublicTicketView } from './dto/public-ticket-view.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private ticketMessagesRepository: Repository<TicketMessage>,
    private serversService: ServersService,
    private usersService: UsersService,
  ) {}

  async create(data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    type?: TicketType;
  }): Promise<PublicTicketViewDto> {
    const ticket = this.ticketsRepository.create(data);
    return toPublicTicketView(await this.ticketsRepository.save(ticket));
  }

  // skip/take are opt-in — see common/dto/pagination.dto.ts. Tickets is the
  // one list here that genuinely grows without bound over time, so this is
  // the endpoint most worth actually using pagination on once volume shows up.
  async findAll(
    status?: TicketStatus,
    clientId?: string,
    skip?: number,
    take?: number,
  ): Promise<Ticket[]> {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (clientId) where.client = { id: clientId };
    return this.ticketsRepository.find({
      where,
      // client/server: staff needs the home/client context on
      // client-portal tickets (null for anonymous /tickets/public leads,
      // which is why every consumer already treats them as optional).
      // `assignedTo` deliberately NOT loaded — StaffTicketViewDto/
      // AdminTicketReadViewDto don't expose it (P1.4-D audit found zero
      // consumers reading it), so loading it here was a wasted join. Add it
      // back if a real consumer needs the field.
      relations: ['client', 'server'],
      order: { createdAt: 'DESC' },
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    });
  }

  async findById(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id },
      relations: ['client', 'server'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async updateStatus(
    id: string,
    status: TicketStatus,
    actor: { id: string; role: UserRole },
    assignedToId?: string,
    internalNotes?: string,
  ): Promise<Ticket> {
    const ticket = await this.findById(id);
    if (!isAllowedTicketStatusTransition(ticket.status, status)) {
      throw new BadRequestException(
        `Cannot change ticket status from "${ticket.status}" to "${status}"`,
      );
    }

    const update: any = { status };
    if (assignedToId) update.assignedTo = { id: assignedToId };
    if (internalNotes !== undefined) update.internalNotes = internalNotes;
    await this.ticketsRepository.update(id, update);

    // Only a real transition leaves a trail — a same-status save (e.g. just
    // assigning/adding internalNotes) isn't a status change worth recording.
    if (status !== ticket.status) {
      await this.ticketMessagesRepository.save(
        this.ticketMessagesRepository.create({
          ticket: { id } as any,
          author: { id: actor.id } as any,
          authorRole: actor.role,
          internal: true,
          message: `Status changed: ${ticket.status} → ${status}`,
        }),
      );
    }

    return this.findById(id);
  }

  // Throws ForbiddenException if the server does not belong to the given
  // client — same shape as AccessService.assertOwnership, kept local here
  // since it's keyed by clientId (already resolved by the controller) rather
  // than the raw userId that access's version takes.
  // Returns the fetched Server so createForClient can build its response
  // from it directly, instead of a second lookup.
  private async assertServerOwnership(
    serverId: string,
    clientId: string,
  ): Promise<Server> {
    const server = await this.serversService.findById(serverId);
    if (server.client?.id !== clientId) {
      throw new ForbiddenException('Server does not belong to this account');
    }
    return server;
  }

  async findAllForClient(clientId: string): Promise<ClientTicketViewDto[]> {
    const tickets = await this.ticketsRepository.find({
      where: { client: { id: clientId } },
      relations: ['server'],
      order: { createdAt: 'DESC' },
    });
    return tickets.map(toClientTicketView);
  }

  // Returns the ticket plus its client-visible conversation (internal notes
  // excluded). Scoped by clientId, not just id — a client requesting
  // someone else's ticket id gets the same 404 as a nonexistent one.
  async findByIdForClient(
    id: string,
    clientId: string,
  ): Promise<ClientTicketDetailViewDto> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id, client: { id: clientId } },
      relations: ['server'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const messages = await this.ticketMessagesRepository.find({
      where: { ticket: { id }, internal: false },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });

    return {
      ...toClientTicketView(ticket),
      messages: messages.map(toClientTicketMessageView),
    };
  }

  async createForClient(
    clientId: string,
    author: { firstName: string; lastName: string; email: string },
    data: {
      type: TicketType;
      subject: string;
      description: string;
      serverId: string;
    },
  ): Promise<ClientTicketViewDto> {
    const server = await this.assertServerOwnership(data.serverId, clientId);

    const ticket = this.ticketsRepository.create({
      client: { id: clientId } as any,
      server: { id: data.serverId } as any,
      type: data.type,
      subject: data.subject,
      message: data.description,
      name: `${author.firstName} ${author.lastName}`,
      email: author.email,
    });
    const saved = await this.ticketsRepository.save(ticket);
    return toClientTicketView({ ...saved, server });
  }

  // CLIENT-only reply path — always writes internal: false. Staff replies /
  // internal notes get their own service method in the support-side workflow.
  // authorName comes from the controller's already-loaded Client.user (no
  // extra query needed) — used to build an honest ClientTicketMessageViewDto
  // response instead of the previous raw TicketMessage, whose `author`
  // after .save() was just an unpopulated `{id}` stub, not the full User the
  // entity's type claimed.
  async addClientMessage(
    ticketId: string,
    clientId: string,
    authorUserId: string,
    authorName: { firstName: string; lastName: string },
    message: string,
  ): Promise<ClientTicketMessageViewDto> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId, client: { id: clientId } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const ticketMessage = this.ticketMessagesRepository.create({
      ticket: { id: ticketId } as any,
      author: { id: authorUserId } as any,
      authorRole: UserRole.CLIENT,
      message,
      internal: false,
    });
    const saved = await this.ticketMessagesRepository.save(ticketMessage);
    return {
      id: saved.id,
      message: saved.message,
      authorRole: saved.authorRole,
      author: { id: authorUserId, ...authorName },
      createdAt: saved.createdAt,
    };
  }

  // STAFF-only reply/note path. author comes from the authenticated JWT
  // user (controller resolves it via @CurrentUser(), never from the request
  // body) — authorId/authorRole are never accepted as raw params here.
  // No client-ownership check: any ADMIN/SUPPORT/SALES may message any
  // ticket, matching findAll()/findById()'s existing staff-wide access.
  // One extra findById(author.id) — the JWT payload only carries
  // id/email/role, not firstName/lastName, and StaffTicketMessageViewDto is
  // deliberately the same shape GET already returns (see P1.4-D audit); a
  // cheap indexed PK lookup here is worth it to give both endpoints one
  // honest, consistent contract instead of two different ones.
  async addStaffMessage(
    ticketId: string,
    author: { id: string; role: UserRole },
    message: string,
    internal: boolean,
  ): Promise<StaffTicketMessageViewDto> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const ticketMessage = this.ticketMessagesRepository.create({
      ticket: { id: ticketId } as any,
      author: { id: author.id } as any,
      authorRole: author.role,
      message,
      internal,
    });
    const [saved, authorUser] = await Promise.all([
      this.ticketMessagesRepository.save(ticketMessage),
      this.usersService.findById(author.id),
    ]);
    return toStaffTicketMessageView(saved, {
      id: authorUser.id,
      firstName: authorUser.firstName,
      lastName: authorUser.lastName,
    });
  }

  // STAFF-only conversation view — internal notes included. Distinct from
  // findByIdForClient's message list (which filters internal: false and is
  // scoped by clientId); this one is scoped only by ticket existence, since
  // any staff role may read any ticket's full thread.
  async findMessagesForStaff(
    ticketId: string,
  ): Promise<StaffTicketMessageViewDto[]> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id: ticketId },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const messages = await this.ticketMessagesRepository.find({
      where: { ticket: { id: ticketId } },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });
    return messages.map((msg) =>
      toStaffTicketMessageView(
        msg,
        msg.author
          ? {
              id: msg.author.id,
              firstName: msg.author.firstName,
              lastName: msg.author.lastName,
            }
          : null,
      ),
    );
  }
}
