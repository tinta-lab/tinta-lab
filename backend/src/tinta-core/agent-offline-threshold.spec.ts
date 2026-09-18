import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentMonitorScheduler } from './agent-monitor.scheduler';
import { AgentSession } from './entities/agent-session.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { OFFLINE_THRESHOLD_MS } from './agent-offline-threshold';

// Regression coverage for PHASE1_3_DIAGNOSTICS_SPEC.md §0 item 5: there
// must be exactly one source of truth for the agent-offline threshold.
// DiagnosticsService's `agent` check will import the same constant once
// it exists (Phase 1.3 step 3+) — this file only covers the consumer that
// exists today, AgentMonitorScheduler.
describe('OFFLINE_THRESHOLD_MS', () => {
  it('is exactly 5 minutes', () => {
    expect(OFFLINE_THRESHOLD_MS).toBe(5 * 60 * 1000);
  });

  it('AgentMonitorScheduler computes its staleness cutoff from this exact constant, not a local literal', async () => {
    const findMock = jest.fn(async (_query?: unknown) => []);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentMonitorScheduler,
        {
          provide: getRepositoryToken(AgentSession),
          useValue: { find: findMock, update: jest.fn() },
        },
        {
          provide: getRepositoryToken(Ticket),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    const scheduler = module.get(AgentMonitorScheduler);

    const fixedNow = new Date('2026-09-18T12:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    try {
      await scheduler.checkAgentHealth();
    } finally {
      jest.spyOn(Date, 'now').mockRestore();
    }

    const staleQuery = findMock.mock.calls[0][0] as {
      where: { lastHeartbeatAt: { value: Date } };
    };
    expect(staleQuery.where.lastHeartbeatAt.value.getTime()).toBe(
      fixedNow - OFFLINE_THRESHOLD_MS,
    );
  });
});
