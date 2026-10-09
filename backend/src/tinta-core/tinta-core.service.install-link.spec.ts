import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TintaCoreService, INSTALL_LINK_TTL_MS } from './tinta-core.service';
import { AgentSession } from './entities/agent-session.entity';
import { TintaAgentGateway } from './tinta-agent.gateway';
import { GoldenTemplateService } from './golden-template.service';

// reissueInstallLink() is the admin's "new install link" button. The one
// thing it must never do is rotate the token of an Agent that already
// enrolled — that would silently take a live hub offline.
describe('TintaCoreService.reissueInstallLink', () => {
  let service: TintaCoreService;
  let session: Partial<AgentSession> | null;
  let update: jest.Mock;
  let disconnectAgent: jest.Mock;

  async function build(initial: Partial<AgentSession> | null) {
    session = initial;
    update = jest.fn(async (_where, patch) => { session = { ...session, ...patch }; });
    disconnectAgent = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TintaCoreService,
        {
          provide: getRepositoryToken(AgentSession),
          useValue: { findOne: jest.fn(async () => session), update },
        },
        { provide: TintaAgentGateway, useValue: { disconnectAgent } },
        { provide: GoldenTemplateService, useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'jwt') } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(TintaCoreService);
  }

  it('issues a fresh token valid for the full TTL when the Agent never connected', async () => {
    await build({ clientId: 'c1', installToken: 'old', lastConnectedAt: null as any });
    const before = Date.now();
    const res = await service.reissueInstallLink('c1');
    expect(res.installToken).not.toBe('old');
    expect(res.installTokenExpiresAt.getTime()).toBeGreaterThanOrEqual(before + INSTALL_LINK_TTL_MS);
  });

  it('refuses with AGENT_ALREADY_ENROLLED once the Agent has connected, without touching the token', async () => {
    await build({ clientId: 'c1', installToken: null as any, lastConnectedAt: new Date() });
    await expect(service.reissueInstallLink('c1')).rejects.toMatchObject({ code: 'AGENT_ALREADY_ENROLLED' });
    expect(update).not.toHaveBeenCalled();
    expect(disconnectAgent).not.toHaveBeenCalled();
  });

  it('404s when the client has no agent session', async () => {
    await build(null);
    await expect(service.reissueInstallLink('c1')).rejects.toThrow(NotFoundException);
  });
});
