import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TintaCoreService } from './tinta-core.service';
import { AgentSession } from './entities/agent-session.entity';
import { TintaAgentGateway } from './tinta-agent.gateway';
import { GoldenTemplateService } from './golden-template.service';

// Regression coverage for the real-world downgrade bug (2026-09-22): the
// dashboard's Update button used to send whatever version string it was
// given straight through to gateway.sendSelfUpdate() with zero validation
// anywhere in the chain. This suite pins updateAgent() as the one layer
// every caller is forced through, so a bad/stale caller can never push a
// version older than what's already installed.
describe('TintaCoreService.updateAgent / getReleaseInfo', () => {
  let service: TintaCoreService;
  let isConnected: jest.Mock;
  let sendSelfUpdate: jest.Mock;
  let findOne: jest.Mock;
  let configGet: jest.Mock;

  async function buildService(session: Partial<AgentSession> | null) {
    findOne = jest.fn(async () => session);
    isConnected = jest.fn(() => true);
    sendSelfUpdate = jest.fn(() => true);
    configGet = jest.fn((key: string) =>
      key === 'AGENT_LATEST_STABLE_VERSION' ? '2026.9.2' : undefined,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TintaCoreService,
        { provide: getRepositoryToken(AgentSession), useValue: { findOne } },
        {
          provide: TintaAgentGateway,
          useValue: { isConnected, sendSelfUpdate, disconnectAgent: jest.fn() },
        },
        { provide: GoldenTemplateService, useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: ConfigService, useValue: { get: configGet } },
      ],
    }).compile();

    service = module.get(TintaCoreService);
  }

  describe('getReleaseInfo', () => {
    it('returns the configured latest stable version', async () => {
      await buildService(null);
      expect(service.getReleaseInfo()).toEqual({ latestStable: '2026.9.2' });
    });

    // Regression coverage for the exact bug this whole fix targets: an
    // unconfigured release source must fail loudly, never silently fall
    // back to some hardcoded version baked into the code (that's exactly
    // how frontend's `LATEST_VERSION = '2026.8.3'` went stale unnoticed).
    it('throws an explicit, actionable error if AGENT_LATEST_STABLE_VERSION is unset — no silent fallback', async () => {
      await buildService(null);
      configGet.mockReturnValue(undefined);
      expect(() => service.getReleaseInfo()).toThrow(
        /AGENT_LATEST_STABLE_VERSION is not configured or invalid/,
      );
    });

    it('throws the same explicit error if AGENT_LATEST_STABLE_VERSION is malformed — no silent fallback', async () => {
      await buildService(null);
      configGet.mockImplementation((key: string) =>
        key === 'AGENT_LATEST_STABLE_VERSION' ? 'not-a-version' : undefined,
      );
      expect(() => service.getReleaseInfo()).toThrow(
        /AGENT_LATEST_STABLE_VERSION is not configured or invalid/,
      );
    });
  });

  describe('updateAgent', () => {
    it('throws NotFoundException when the client has no session', async () => {
      await buildService(null);
      await expect(service.updateAgent('client-1', '2026.9.2')).rejects.toThrow(NotFoundException);
    });

    it('allows a real update: 2026.9.1 → 2026.9.2', async () => {
      await buildService({ clientId: 'client-1', agentVersion: '2026.9.1' });
      const result = await service.updateAgent('client-1', '2026.9.2');
      expect(result).toEqual({ sent: true, online: true });
      expect(sendSelfUpdate).toHaveBeenCalledWith('client-1', '2026.9.2');
    });

    it('is a no-op when already on the target version', async () => {
      await buildService({ clientId: 'client-1', agentVersion: '2026.9.2' });
      const result = await service.updateAgent('client-1', '2026.9.2');
      expect(result.sent).toBe(false);
      expect(result.alreadyUpToDate).toBe(true);
      expect(sendSelfUpdate).not.toHaveBeenCalled();
    });

    it('BLOCKS the real-world regression: 2026.9.2 → 2026.8.3', async () => {
      await buildService({ clientId: 'client-1', agentVersion: '2026.9.2' });
      await expect(service.updateAgent('client-1', '2026.8.3')).rejects.toThrow(ConflictException);
      expect(sendSelfUpdate).not.toHaveBeenCalled();
    });

    it('blocks any downgrade, even to an intermediate-looking version: 2026.10.0 → 2026.9.2', async () => {
      await buildService({ clientId: 'client-1', agentVersion: '2026.10.0' });
      await expect(service.updateAgent('client-1', '2026.9.2')).rejects.toThrow(ConflictException);
      expect(sendSelfUpdate).not.toHaveBeenCalled();
    });

    it('rejects a malformed target version', async () => {
      await buildService({ clientId: 'client-1', agentVersion: '2026.9.1' });
      await expect(service.updateAgent('client-1', 'garbage')).rejects.toThrow(BadRequestException);
      expect(sendSelfUpdate).not.toHaveBeenCalled();
    });

    it('defaults to the configured latest stable release when no version is given', async () => {
      await buildService({ clientId: 'client-1', agentVersion: '2026.9.1' });
      const result = await service.updateAgent('client-1');
      expect(result.sent).toBe(true);
      expect(sendSelfUpdate).toHaveBeenCalledWith('client-1', '2026.9.2');
    });

    it('returns offline without sending when the agent is not connected', async () => {
      await buildService({ clientId: 'client-1', agentVersion: '2026.9.1' });
      isConnected.mockReturnValue(false);
      const result = await service.updateAgent('client-1', '2026.9.2');
      expect(result).toEqual({ sent: false, online: false });
      expect(sendSelfUpdate).not.toHaveBeenCalled();
    });
  });
});
