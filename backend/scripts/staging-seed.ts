// Staging-only seed script. NOT part of the application — run manually
// against tinta_lab_staging to populate it for browser QA. Uses the real
// entity classes (via the project's own tsconfig paths) so the schema it
// creates (synchronize: true) exactly matches what the app itself expects.
//
// Usage (from backend/): DB_NAME=tinta_lab_staging npx ts-node -r tsconfig-paths/register scripts/staging-seed.ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Client } from '../src/clients/entities/client.entity';
import { Server, ServerStatus } from '../src/servers/entities/server.entity';
import { AccessLog } from '../src/access/entities/access-log.entity';
import { AuditEvent } from '../src/access/entities/audit-event.entity';
import {
  Ticket,
  TicketStatus,
  TicketType,
} from '../src/tickets/entities/ticket.entity';
import { TicketMessage } from '../src/tickets/entities/ticket-message.entity';
import { GoldenTemplate } from '../src/tinta-core/entities/golden-template.entity';
import { AgentSession } from '../src/tinta-core/entities/agent-session.entity';

const STAGING_PASSWORD = 'Staging1234!';

async function main() {
  const dbName = process.env.DB_NAME;
  if (dbName !== 'tinta_lab_staging') {
    throw new Error(
      `Refusing to seed: DB_NAME is "${dbName}", expected "tinta_lab_staging". ` +
        'This script is destructive-ish (creates/reuses fixed test rows) and must never run against a real database.',
    );
  }

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'tinta',
    password: process.env.DB_PASSWORD,
    database: dbName,
    entities: [
      User,
      Client,
      Server,
      AccessLog,
      AuditEvent,
      Ticket,
      TicketMessage,
      GoldenTemplate,
      AgentSession,
    ],
    synchronize: true,
    logging: false,
  });
  await ds.initialize();
  console.log('[seed] schema synchronized against tinta_lab_staging');

  const users = ds.getRepository(User);
  const clients = ds.getRepository(Client);
  const servers = ds.getRepository(Server);
  const tickets = ds.getRepository(Ticket);
  const messages = ds.getRepository(TicketMessage);
  const accessLogs = ds.getRepository(AccessLog);

  const hashed = await bcrypt.hash(STAGING_PASSWORD, 12);

  async function upsertUser(
    email: string,
    role: UserRole,
    firstName: string,
    lastName: string,
  ): Promise<User> {
    const existing = await users.findOne({ where: { email } });
    if (existing) return existing;
    return users.save(
      users.create({ email, password: hashed, role, firstName, lastName }),
    );
  }

  const admin = await upsertUser('admin@staging.test', UserRole.ADMIN, 'Staging', 'Admin');
  const support = await upsertUser('support@staging.test', UserRole.SUPPORT, 'Staging', 'Support');
  const sales = await upsertUser('sales@staging.test', UserRole.SALES, 'Staging', 'Sales');
  const clientUserA = await upsertUser('client-a@staging.test', UserRole.CLIENT, 'Anna', 'Müller-Langtitel-Für-Umbruch-Test');
  const clientUserB = await upsertUser('client-b@staging.test', UserRole.CLIENT, 'Max', 'Weber');

  async function upsertClient(user: User, phone: string, city: string): Promise<Client> {
    const existing = await clients.findOne({ where: { user: { id: user.id } } });
    if (existing) return existing;
    return clients.save(clients.create({ user, phone, city, country: 'DE', isInstalled: true }));
  }

  const clientA = await upsertClient(clientUserA, '+49 151 0000001', 'Berlin');
  const clientB = await upsertClient(clientUserB, '+49 151 0000002', 'München');

  async function upsertServer(client: Client, name: string, subdomain: string): Promise<Server> {
    const existing = await servers.findOne({ where: { subdomain } });
    if (existing) return existing;
    return servers.save(
      servers.create({
        client,
        name,
        subdomain,
        status: ServerStatus.ONLINE,
        haVersion: '2026.9.1',
        lastSeenAt: new Date(),
      }),
    );
  }

  const serverA = await upsertServer(clientA, 'Home — Berlin', 'staging-client-a');
  const serverB = await upsertServer(
    clientB,
    'A Very Long Server Name That Should Wrap Or Truncate In The Card Layout',
    'staging-client-b',
  );

  async function upsertTicket(
    subject: string,
    status: TicketStatus,
    type: TicketType,
    client: Client | null,
    server: Server | null,
    name: string,
    email: string,
  ): Promise<Ticket> {
    const existing = await tickets.findOne({ where: { subject } });
    if (existing) return existing;
    return tickets.save(
      tickets.create({
        subject,
        status,
        type,
        client: client ?? undefined,
        server: server ?? undefined,
        name,
        email,
        message: `Seed ticket body for "${subject}".`,
      }),
    );
  }

  const t1 = await upsertTicket(
    'Living room lights not responding',
    TicketStatus.NEW,
    TicketType.SUPPORT,
    clientA,
    serverA,
    'Anna Müller',
    clientUserA.email,
  );
  const t2 = await upsertTicket(
    'Automation broken after update',
    TicketStatus.IN_PROGRESS,
    TicketType.SUPPORT,
    clientA,
    serverA,
    'Anna Müller',
    clientUserA.email,
  );
  await upsertTicket(
    'A ticket with a genuinely excessive subject line meant to stress-test how the staff ticket card handles wrapping and truncation in narrow layouts',
    TicketStatus.WAITING_CLIENT,
    TicketType.OTHER,
    clientB,
    serverB,
    'Max Weber',
    clientUserB.email,
  );
  await upsertTicket(
    'Cannot connect to Home Assistant',
    TicketStatus.RESOLVED,
    TicketType.SUPPORT,
    clientB,
    serverB,
    'Max Weber',
    clientUserB.email,
  );
  await upsertTicket(
    'Installation request — new property',
    TicketStatus.CLOSED,
    TicketType.INSTALLATION,
    null,
    null,
    'Interested Lead',
    'lead@staging.test',
  );

  async function upsertMessage(ticket: Ticket, author: User, message: string, internal: boolean) {
    const existing = await messages.findOne({ where: { ticket: { id: ticket.id }, message } });
    if (existing) return existing;
    return messages.save(
      messages.create({ ticket, author, authorRole: author.role, message, internal }),
    );
  }

  await upsertMessage(t1, support, 'Looking into the Zigbee coordinator now.', false);
  await upsertMessage(t1, support, 'Checked HA logs — coordinator dropped off USB.', true);

  // Active Support Session — server B carries an open, un-revoked grant so
  // "Active Support Sessions" on /dashboard/support has something to show.
  const existingActive = await accessLogs.findOne({
    where: { server: { id: serverB.id }, isRevoked: false },
  });
  if (!existingActive) {
    await servers.update(serverB.id, {
      accessEnabled: true,
      accessExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await accessLogs.save(
      accessLogs.create({
        server: serverB,
        grantedBy: clientUserB,
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        supportPassword: 'seed-not-a-real-session',
        reason: 'client_toggle',
        ticket: t2,
      }),
    );
  }

  console.log('[seed] done.');
  console.log('[seed] credentials (all use the same password):');
  console.log(`  ADMIN:   ${admin.email} / ${STAGING_PASSWORD}`);
  console.log(`  SUPPORT: ${support.email} / ${STAGING_PASSWORD}`);
  console.log(`  SALES:   ${sales.email} / ${STAGING_PASSWORD}`);
  console.log(`  CLIENT A: ${clientUserA.email} / ${STAGING_PASSWORD}`);
  console.log(`  CLIENT B: ${clientUserB.email} / ${STAGING_PASSWORD}`);

  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
