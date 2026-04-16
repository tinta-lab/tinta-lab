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

  async findAll(status?: TicketStatus): Promise<Ticket[]> {
    const where = status ? { status } : {};
    return this.ticketsRepository.find({
      where,
      relations: ['assignedTo'],
      order: { createdAt: 'DESC' },
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
