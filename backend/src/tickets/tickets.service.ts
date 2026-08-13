import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus, TicketType } from './entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private ticketsRepository: Repository<Ticket>,
  ) {}

  async create(data: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    type?: TicketType;
  }): Promise<Ticket> {
    const ticket = this.ticketsRepository.create(data);
    return this.ticketsRepository.save(ticket);
  }

  // skip/take are opt-in — see common/dto/pagination.dto.ts. Tickets is the
  // one list here that genuinely grows without bound over time, so this is
  // the endpoint most worth actually using pagination on once volume shows up.
  async findAll(status?: TicketStatus, skip?: number, take?: number): Promise<Ticket[]> {
    const where = status ? { status } : {};
    return this.ticketsRepository.find({
      where,
      relations: ['assignedTo'],
      order: { createdAt: 'DESC' },
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    });
  }

  async findById(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id },
      relations: ['assignedTo'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async updateStatus(
    id: string,
    status: TicketStatus,
    assignedToId?: string,
    internalNotes?: string,
  ): Promise<Ticket> {
    const update: any = { status };
    if (assignedToId) update.assignedTo = { id: assignedToId };
    if (internalNotes !== undefined) update.internalNotes = internalNotes;
    await this.ticketsRepository.update(id, update);
    return this.findById(id);
  }
}
