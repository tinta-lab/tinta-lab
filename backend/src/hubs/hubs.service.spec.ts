import { HubsService } from './hubs.service';
import { Server } from '../servers/entities/server.entity';
import { AgentSession } from '../tinta-core/entities/agent-session.entity';

// Hub cleanup (contract-completeness backlog item from P1.4): HubsService
// previously returned a plain `Hub`/`HubAgent` interface — invisible to the
// Swagger CLI plugin, so GET /hubs and GET /hubs/:id had no OpenAPI schema
// at all despite returning real data. These tests pin the mapping logic
// (toHubView/mapSession) directly, independent of the DTO/HTTP layer.
function makeServer(overrides: Partial<Server> = {}): Server {
  return {
    id: 'srv-1',
    name: 'Home — Berlin',
    subdomain: 'client-a',
    hubId: 'abc123',
    tunnelId: 'tunnel-xyz',
    cfAccessAppId: 'cf-access-app-id',
    tunnelToken: 'super-secret-tunnel-token',
    cfDnsRecordId: 'cf-dns-record-id',
    status: 'online' as any,
    accessEnabled: false,
    accessExpiresAt: null,
    lastSeenAt: null,
    publicStatus: 'unknown' as any,
    publicCheckedAt: null,
    haVersion: '2026.9.1',
    localUrl: 'http://192.168.1.50:8123',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    client: {
      id: 'client-1',
      phone: '+49 151 0000001',
      city: 'Berlin',
      user: {
        id: 'user-1',
        firstName: 'Anna',
        lastName: 'Müller',
        email: 'anna@example.test',
      },
    } as any,
    ...overrides,
  } as Server;
}

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 'session-1',
    clientId: 'client-1',
    status: 'connected',
    agentVersion: '2026.9.0',
    haVersion: '2026.9.1',
    appliedTemplates: ['tpl-1'],
    metrics: {
      cpuPercent: 12,
      memPercent: 34,
      diskPercent: 56,
      deviceCount: 7,
      automationCount: 3,
      uptimeSeconds: 999999,
    },
    lastConnectedAt: new Date('2026-01-02T00:00:00.000Z'),
    lastHeartbeatAt: new Date('2026-01-02T00:05:00.000Z'),
    lastTokenMismatchAt: null,
    installToken: 'install-token-abc',
    installTokenExpiresAt: new Date('2026-01-03T00:00:00.000Z'),
    ...overrides,
  } as AgentSession;
}

function createHubsService(opts: {
  servers?: Server[];
  sessions?: AgentSession[];
  isConnected?: boolean;
} = {}) {
  const servers = opts.servers ?? [makeServer()];
  const sessions = opts.sessions ?? [makeSession()];

  const serverRepo = {
    find: () => Promise.resolve(servers),
    findOne: () => Promise.resolve(servers[0] ?? null),
  };
  const sessionRepo = {
    find: () => Promise.resolve(sessions),
    findOne: () => Promise.resolve(sessions[0] ?? null),
  };
  const config = { get: (_key: string, fallback: string) => fallback };
  const gateway = { isConnected: () => opts.isConnected ?? true };

  return new HubsService(
    serverRepo as any,
    sessionRepo as any,
    config as any,
    gateway as any,
  );
}

describe('HubsService', () => {
  describe('findAll', () => {
    it('never includes tunnelToken, cfDnsRecordId, or cfAccessAppId', async () => {
      const service = createHubsService();
      const hubs = await service.findAll();

      expect(hubs).toHaveLength(1);
      const hub = hubs[0] as unknown as Record<string, unknown>;
      expect(hub.tunnelToken).toBeUndefined();
      expect(hub.cfDnsRecordId).toBeUndefined();
      expect(hub.cfAccessAppId).toBeUndefined();
    });

    it('includes the fields the admin/hubs UI actually renders', async () => {
      const service = createHubsService();
      const [hub] = await service.findAll();

      expect(hub.id).toBe('srv-1');
      expect(hub.name).toBe('Home — Berlin');
      expect(hub.hubId).toBe('abc123');
      expect(hub.tunnelId).toBe('tunnel-xyz');
      expect(hub.localUrl).toBe('http://192.168.1.50:8123');
      expect(hub.publicUrl).toBe('https://hub-abc123.tinta-lab.de');
      expect(hub.client).toEqual({
        id: 'client-1',
        phone: '+49 151 0000001',
        city: 'Berlin',
        user: { firstName: 'Anna', lastName: 'Müller', email: 'anna@example.test' },
      });
    });

    it('drops fields confirmed unused by the admin/hubs UI (status, subdomain, client.user.id, agent.status, agent.lastHeartbeatAt, metrics.uptimeSeconds)', async () => {
      const service = createHubsService();
      const [hub] = await service.findAll();
      const raw = hub as unknown as Record<string, unknown>;
      const client = hub.client as unknown as Record<string, unknown>;
      const clientUser = hub.client.user as unknown as Record<string, unknown>;
      const agent = hub.agent as unknown as Record<string, unknown>;
      const metrics = hub.agent!.metrics as unknown as Record<string, unknown>;

      expect(raw.status).toBeUndefined();
      expect(raw.subdomain).toBeUndefined();
      expect(client.id).toBe('client-1'); // client.id stays — only client.user.id is dropped
      expect(clientUser.id).toBeUndefined();
      expect(agent.status).toBeUndefined();
      expect(agent.lastHeartbeatAt).toBeUndefined();
      expect(metrics.uptimeSeconds).toBeUndefined();
    });

    it('maps agent metrics and applied templates when a session exists', async () => {
      const service = createHubsService();
      const [hub] = await service.findAll();

      expect(hub.agent).not.toBeNull();
      expect(hub.agent!.metrics).toEqual({
        cpuPercent: 12,
        memPercent: 34,
        diskPercent: 56,
        deviceCount: 7,
        automationCount: 3,
      });
      expect(hub.agent!.appliedTemplates).toEqual(['tpl-1']);
      expect(hub.agent!.installToken).toBe('install-token-abc');
      expect(hub.agent!.isOnline).toBe(true);
    });

    it('agent is null when the client has no AgentSession row', async () => {
      const service = createHubsService({ sessions: [] });
      const [hub] = await service.findAll();
      expect(hub.agent).toBeNull();
    });
  });

  describe('findOne', () => {
    it('returns null when the server does not exist', async () => {
      const service = createHubsService({ servers: [] });
      const hub = await service.findOne('missing-id');
      expect(hub).toBeNull();
    });

    it('returns the same shape as findAll for a single hub', async () => {
      const service = createHubsService();
      const hub = await service.findOne('srv-1');
      expect(hub).not.toBeNull();
      expect((hub as unknown as Record<string, unknown>).tunnelToken).toBeUndefined();
      expect(hub!.tunnelId).toBe('tunnel-xyz');
    });
  });
});
