import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './entities/user.entity';
import { Client } from '../clients/entities/client.entity';
import { CloudflareService } from '../cloudflare/cloudflare.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Client)
    private clientsRepository: Repository<Client>,
    private dataSource: DataSource,
    @Optional() private cloudflare: CloudflareService,
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

    const saved = await this.usersRepository.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = saved;
    return result as User;
  }

  // Only used by AuthService for login — explicitly selects password for comparison
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
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
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'role',
        'isActive',
        'createdAt',
      ],
    });
  }

  async update(
    id: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: UserRole;
      isActive?: boolean;
    },
  ): Promise<User> {
    if (data.email) {
      const existing = await this.usersRepository.findOne({
        where: { email: data.email },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }
    await this.usersRepository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    const client = await this.clientsRepository.findOne({ where: { user: { id } } });
    if (client) {
      // Cloudflare cleanup for each server before deleting them
      if (this.cloudflare?.isEnabled) {
        const servers = await this.dataSource.query(
          `SELECT id, "tunnelId", "cfDnsRecordId", "cfAccessAppId" FROM servers WHERE "clientId" = $1`,
          [client.id],
        );
        for (const srv of servers) {
          if (srv.tunnelId) await this.cloudflare.deleteTunnel(srv.tunnelId);
          if (srv.cfDnsRecordId) await this.cloudflare.deleteDnsRecord(srv.cfDnsRecordId);
          if (srv.cfAccessAppId) await this.cloudflare.deleteAccessApp(srv.cfAccessAppId);
        }
      }
      // access_logs that reference this client's servers
      await this.dataSource.query(
        `DELETE FROM access_logs WHERE "serverId" IN (SELECT id FROM servers WHERE "clientId" = $1)`,
        [client.id],
      );
      // Servers
      await this.dataSource.query(`DELETE FROM servers WHERE "clientId" = $1`, [client.id]);
      // Agent sessions
      await this.dataSource.query(`DELETE FROM agent_sessions WHERE "clientId" = $1`, [client.id]);
    }
    // access_logs where this user granted or received access
    await this.dataSource.query(
      `DELETE FROM access_logs WHERE "grantedById" = $1 OR "accessedById" = $1`,
      [id],
    );
    // Tickets: unassign instead of delete (preserve ticket history)
    await this.dataSource.query(`UPDATE tickets SET "assignedToId" = NULL WHERE "assignedToId" = $1`, [id]);
    // Client record
    if (client) await this.clientsRepository.delete(client.id);
    // User
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('User not found');
  }

  // Admin-initiated reset — no knowledge of the old password required.
  async resetPassword(id: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.usersRepository.update(id, {
      password: hashed,
      passwordChangedAt: new Date(),
    });
  }

  // Self-service change — caller must prove they know the current password.
  async changeOwnPassword(
    id: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new ForbiddenException('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.usersRepository.update(id, {
      password: hashed,
      passwordChangedAt: new Date(),
    });
  }

  async updateOwnProfile(
    id: string,
    data: { firstName?: string; lastName?: string },
  ): Promise<User> {
    await this.usersRepository.update(id, data);
    return this.findById(id);
  }

  // Lean lookup for JwtStrategy — runs on every authenticated request, so
  // only pull the columns needed to validate the token is still current.
  async getAuthMeta(
    id: string,
  ): Promise<{ passwordChangedAt: Date | null } | null> {
    return this.usersRepository.findOne({
      where: { id },
      select: ['id', 'passwordChangedAt'],
    });
  }

  async findStaffActivity(connectedUserIds: Set<string>) {
    const staff = await this.usersRepository.find({
      where: [{ role: UserRole.SUPPORT }, { role: UserRole.SALES }],
      order: { firstName: 'ASC' },
    });

    const staffIds = staff.map(u => u.id);
    if (staffIds.length === 0) return [];

    const sessions = await this.dataSource.query(
      `SELECT al.id, al."grantedAt", al."connectedAt", al."revokedAt", al."expiresAt",
              al."isRevoked", al.reason, al."activityLog",
              al."accessedById",
              s.id as "serverId", s.name as "serverName",
              u."firstName" as "clientFirstName", u."lastName" as "clientLastName"
       FROM access_logs al
       LEFT JOIN servers s ON s.id = al."serverId"
       LEFT JOIN clients c ON c.id = s."clientId"
       LEFT JOIN users u ON u.id = c."userId"
       WHERE al."accessedById" = ANY($1)
       ORDER BY al."grantedAt" DESC
       LIMIT 200`,
      [staffIds],
    );

    const sessionsByUser = new Map<string, typeof sessions>();
    for (const row of sessions) {
      if (!sessionsByUser.has(row.accessedById)) sessionsByUser.set(row.accessedById, []);
      sessionsByUser.get(row.accessedById)!.push(row);
    }

    return staff.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      isOnline: connectedUserIds.has(u.id),
      recentSessions: (sessionsByUser.get(u.id) ?? []).slice(0, 20).map(row => ({
        id: row.id,
        grantedAt: row.grantedAt,
        connectedAt: row.connectedAt,
        revokedAt: row.revokedAt,
        expiresAt: row.expiresAt,
        isRevoked: row.isRevoked,
        reason: row.reason,
        activityLog: row.activityLog,
        server: {
          id: row.serverId,
          name: row.serverName,
          clientName: `${row.clientFirstName ?? ''} ${row.clientLastName ?? ''}`.trim(),
        },
      })),
    }));
  }
}
