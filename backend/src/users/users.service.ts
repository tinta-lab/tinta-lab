import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: UserRole = UserRole.CLIENT,
  ): Promise<User> {
    const exists = await this.usersRepository.findOne({ where: { email } });
    if (exists) throw new ConflictException('Email already exists');

    const hashed = await bcrypt.hash(password, 12);
    const user = this.usersRepository.create({
      email,
      password: hashed,
      firstName,
      lastName,
      role,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'isActive', 'createdAt'],
    });
  }

  async update(id: string, data: { firstName?: string; lastName?: string; role?: UserRole; isActive?: boolean }): Promise<User> {
    await this.usersRepository.update(id, data);
    return this.findById(id);
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.usersRepository.update(id, { password: hashed });
  }
}
