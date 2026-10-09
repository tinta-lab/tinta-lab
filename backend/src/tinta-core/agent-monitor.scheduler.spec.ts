import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentMonitorScheduler, AUTO_OFFLINE_PREFIX } from './agent-monitor.scheduler';
import { AgentSession, AgentStatus } from './entities/agent-session.entity';
import { Ticket, TicketStatus } from '../tickets/entities/ticket.entity';
import { ServersService } from '../servers/servers.service';

describe('AgentMonitorScheduler', () => {
  const client = { id: 'c1', user: { firstName: 'Anna', lastName: 'Muster', email: 'anna@example.com' } };
  let sessionsByStatus: Record<string, any[]>;
  let ticketRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; create: jest.Mock; update: jest.Mock };
  let scheduler: AgentMonitorScheduler;

  beforeEach(async () => {
    sessionsByStatus = { stale: [], online: [] };
    ticketRepo = {
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      save: jest.fn(async (t) => t),
      create: jest.fn((t) => t),
      update: jest.fn(async () => undefined),
    };
    const sessionRepo = {
      // first find() = stale query (has lastHeartbeatAt), second = online
      find: jest.fn(async ({ where }) => (where.lastHeartbeatAt ? sessionsByStatus.stale : sessionsByStatus.online)),
      update: jest.fn(async () => undefined),
    };
    const mod = await Test.createTestingModule({
      providers: [
        AgentMonitorScheduler,
        { provide: getRepositoryToken(AgentSession), useValue: sessionRepo },
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: ServersService, useValue: { findByClientId: jest.fn(async () => [{ id: 's1' }]) } },
      ],
    }).compile();
    scheduler = mod.get(AgentMonitorScheduler);
  });

  it('opens one ticket linked to the client and hub for a silent agent', async () => {
    sessionsByStatus.stale = [{ clientId: 'c1', client, status: AgentStatus.CONNECTED }];
    await scheduler.checkAgentHealth();
    expect(ticketRepo.save).toHaveBeenCalledTimes(1);
    expect(ticketRepo.save.mock.calls[0][0]).toMatchObject({
      subject: `${AUTO_OFFLINE_PREFIX}: Anna Muster`,
      client: { id: 'c1' },
      server: { id: 's1' },
    });
  });

  it('does not duplicate when an open auto-ticket already exists (survives restarts)', async () => {
    sessionsByStatus.stale = [{ clientId: 'c1', client, status: AgentStatus.CONNECTED }];
    ticketRepo.findOne.mockResolvedValue({ id: 't-open' });
    await scheduler.checkAgentHealth();
    expect(ticketRepo.save).not.toHaveBeenCalled();
  });

  it('resolves untouched auto-tickets once the agent is back, with an internal note', async () => {
    sessionsByStatus.online = [{ clientId: 'c1', client, status: AgentStatus.CONNECTED }];
    ticketRepo.find.mockResolvedValue([{ id: 't1', internalNotes: null, status: TicketStatus.NEW }]);
    await scheduler.checkAgentHealth();
    expect(ticketRepo.update).toHaveBeenCalledWith('t1', expect.objectContaining({ status: TicketStatus.RESOLVED }));
    // only NEW tickets are matched — anything staff already picked up stays
    for (const cond of ticketRepo.find.mock.calls[0][0].where) expect(cond.status).toBe(TicketStatus.NEW);
  });
});
