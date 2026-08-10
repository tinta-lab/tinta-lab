import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoldenTemplateService } from './golden-template.service';
import { GoldenTemplate } from './entities/golden-template.entity';
import { AgentSession } from './entities/agent-session.entity';

// Regression coverage for the "agent reconnects repeatedly" scenario raised
// during review: TintaAgentGateway.handleRegister re-applies default golden
// templates on every successful register, gated on session.appliedTemplates.
// markApplied() is the layer that must stay idempotent no matter how many
// times it's called for the same (clientId, slug) pair.
describe('GoldenTemplateService.markApplied', () => {
  let service: GoldenTemplateService;
  let session: AgentSession;
  let saveSpy: jest.Mock;

  beforeEach(async () => {
    session = { clientId: 'client-1', appliedTemplates: [] } as unknown as AgentSession;
    saveSpy = jest.fn(async (s: AgentSession) => {
      session = s;
      return s;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoldenTemplateService,
        {
          provide: getRepositoryToken(GoldenTemplate),
          useValue: {},
        },
        {
          provide: getRepositoryToken(AgentSession),
          useValue: {
            findOne: jest.fn(async () => session),
            save: saveSpy,
          },
        },
      ],
    }).compile();

    service = module.get(GoldenTemplateService);
  });

  it('adds the slug on first application', async () => {
    await service.markApplied('client-1', 'welcome-lights');
    expect(session.appliedTemplates).toEqual(['welcome-lights']);
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('does not re-save or duplicate the slug on a repeated call (simulated agent reconnect)', async () => {
    await service.markApplied('client-1', 'welcome-lights');
    await service.markApplied('client-1', 'welcome-lights');
    await service.markApplied('client-1', 'welcome-lights');

    expect(session.appliedTemplates).toEqual(['welcome-lights']);
    // Only the first call should have hit the DB — the other two are no-ops.
    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it('applying a second, different template keeps the first and only saves the delta', async () => {
    await service.markApplied('client-1', 'welcome-lights');
    await service.markApplied('client-1', 'climate-schedule');
    await service.markApplied('client-1', 'welcome-lights'); // reconnect, already applied

    expect(session.appliedTemplates.sort()).toEqual(['climate-schedule', 'welcome-lights']);
    expect(saveSpy).toHaveBeenCalledTimes(2);
  });
});
