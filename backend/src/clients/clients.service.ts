import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './entities/client.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    private usersService: UsersService,
  ) {}

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
    city?: string;
  }): Promise<Client> {
    const user = await this.usersService.create(
      data.email,
      data.password,
      data.firstName,
      data.lastName,
      UserRole.CLIENT,
    );

    const client = this.clientsRepository.create({
      user,
      phone: data.phone,
      address: data.address,
      city: data.city,
    });
    return this.clientsRepository.save(client);
  }

  async findAll(): Promise<Client[]> {
    return this.clientsRepository.find({ relations: ['user'] });
  }

  async findById(id: string): Promise<Client> {
    const client = await this.clientsRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async findByUserId(userId: string): Promise<Client> {
    const client = await this.clientsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async findByUserIdOptional(userId: string): Promise<Client | null> {
    return this.clientsRepository.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    });
  }

  async createForUser(userId: string, data: { phone: string; city?: string }): Promise<Client> {
    const user = await this.usersService.findById(userId);
    const client = this.clientsRepository.create({
      user,
      phone: data.phone,
      city: data.city,
    });
    return this.clientsRepository.save(client);
  }

  async update(id: string, data: Partial<Client>): Promise<Client> {
    await this.clientsRepository.update(id, data);
    return this.findById(id);
  }
}
