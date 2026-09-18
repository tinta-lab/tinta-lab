import {
  checkClient,
  checkHub,
  checkServer,
  checkAgent,
  checkHomeAssistant,
  checkPublicConnectivity,
  checkSupportAccess,
  checkResources,
  checkTemplates,
  checkAudit,
  checkProvisioning,
} from './diagnostic-checks';
import { DiagnosticStatus } from './dto/diagnostic-status.enum';
import { ServerStatus, ServerPublicStatus } from '../servers/entities/server.entity';

const NOW = new Date('2026-09-18T12:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe('checkClient', () => {
  it('active -> OK', () => {
    expect(checkClient({ isActive: true, now: NOW }).status).toBe(DiagnosticStatus.OK);
  });
  it('inactive -> ERROR / CLIENT_INACTIVE', () => {
    const r = checkClient({ isActive: false, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('CLIENT_INACTIVE');
  });
  it('sets checkedAt to the given now, not some other time', () => {
    expect(checkClient({ isActive: true, now: NOW }).checkedAt).toBe(NOW);
  });
});

describe('checkHub', () => {
  it('no server -> UNKNOWN / NO_SERVER', () => {
    const r = checkHub({ hasServer: false, hubId: null, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).toBe('NO_SERVER');
  });
  it('server without hub -> ERROR / HUB_NOT_LINKED', () => {
    const r = checkHub({ hasServer: true, hubId: null, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('HUB_NOT_LINKED');
  });
  it('server with hub -> OK', () => {
    const r = checkHub({ hasServer: true, hubId: 'hub-1', now: NOW });
    expect(r.status).toBe(DiagnosticStatus.OK);
  });
});

describe('checkServer', () => {
  it('no server -> UNKNOWN / NO_SERVER', () => {
    const r = checkServer({ hasServer: false, status: null, lastSeenAt: null, multiServerDetected: false, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).toBe('NO_SERVER');
  });
  it('ONLINE -> OK', () => {
    const r = checkServer({ hasServer: true, status: ServerStatus.ONLINE, lastSeenAt: NOW, multiServerDetected: false, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.OK);
  });
  it('OFFLINE, lastSeenAt within 24h -> WARNING / SERVER_RECENTLY_OFFLINE', () => {
    const lastSeenAt = new Date(NOW.getTime() - 23 * HOUR);
    const r = checkServer({ hasServer: true, status: ServerStatus.OFFLINE, lastSeenAt, multiServerDetected: false, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.WARNING);
    expect(r.code).toBe('SERVER_RECENTLY_OFFLINE');
  });
  it('OFFLINE, lastSeenAt older than 24h -> ERROR / SERVER_OFFLINE', () => {
    const lastSeenAt = new Date(NOW.getTime() - 25 * HOUR);
    const r = checkServer({ hasServer: true, status: ServerStatus.OFFLINE, lastSeenAt, multiServerDetected: false, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('SERVER_OFFLINE');
  });
  it('OFFLINE, lastSeenAt null -> ERROR / SERVER_OFFLINE', () => {
    const r = checkServer({ hasServer: true, status: ServerStatus.OFFLINE, lastSeenAt: null, multiServerDetected: false, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('SERVER_OFFLINE');
  });
  it('UNKNOWN status -> UNKNOWN, not ERROR (spec exhaustiveness fix)', () => {
    const r = checkServer({ hasServer: true, status: ServerStatus.UNKNOWN, lastSeenAt: null, multiServerDetected: false, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).toBe('SERVER_STATUS_UNKNOWN');
  });
});

describe('checkAgent', () => {
  const base = {
    lastConnectedAt: NOW,
    lastHeartbeatAt: NOW,
    agentVersion: '1.0.0',
    now: NOW,
  };
  it('online + report -> OK', () => {
    const r = checkAgent({ ...base, hasSession: true, agentOnline: true, hasReport: true });
    expect(r.status).toBe(DiagnosticStatus.OK);
    expect(r.code).toBe('AGENT_ONLINE');
  });
  it('online + report=null -> WARNING / AGENT_UNRESPONSIVE', () => {
    const r = checkAgent({ ...base, hasSession: true, agentOnline: true, hasReport: false });
    expect(r.status).toBe(DiagnosticStatus.WARNING);
    expect(r.code).toBe('AGENT_UNRESPONSIVE');
  });
  it('offline -> ERROR / AGENT_OFFLINE', () => {
    const r = checkAgent({ ...base, hasSession: true, agentOnline: false, hasReport: false });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('AGENT_OFFLINE');
  });
  it('no session -> UNKNOWN / AGENT_NOT_PROVISIONED', () => {
    const r = checkAgent({ ...base, hasSession: false, agentOnline: false, hasReport: false });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).toBe('AGENT_NOT_PROVISIONED');
  });
});

describe('checkHomeAssistant (cascade from agent liveness)', () => {
  it('live report + haConnected true -> OK', () => {
    const r = checkHomeAssistant({ hasLiveReport: true, haConnected: true, haVersion: '2026.9', now: NOW });
    expect(r.status).toBe(DiagnosticStatus.OK);
  });
  it('live report + haConnected false -> ERROR / HA_API_UNAVAILABLE', () => {
    const r = checkHomeAssistant({ hasLiveReport: true, haConnected: false, haVersion: '2026.9', now: NOW });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('HA_API_UNAVAILABLE');
  });
  it('no live report (agent offline/unresponsive) -> UNKNOWN, never a separate ERROR', () => {
    const r = checkHomeAssistant({ hasLiveReport: false, haConnected: null, haVersion: null, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).not.toBe('HA_API_UNAVAILABLE');
  });
});

describe('checkPublicConnectivity (cloudflare key)', () => {
  it('REACHABLE -> OK', () => {
    const r = checkPublicConnectivity({
      publicStatus: ServerPublicStatus.REACHABLE,
      publicCheckedAt: NOW,
      publicUrl: 'foo.tinta-lab.de',
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.OK);
  });
  it('UNREACHABLE -> ERROR / PUBLIC_URL_UNREACHABLE', () => {
    const r = checkPublicConnectivity({
      publicStatus: ServerPublicStatus.UNREACHABLE,
      publicCheckedAt: NOW,
      publicUrl: 'foo.tinta-lab.de',
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('PUBLIC_URL_UNREACHABLE');
  });
  it('UNKNOWN -> UNKNOWN, not ERROR (never never probed != a fault)', () => {
    const r = checkPublicConnectivity({
      publicStatus: ServerPublicStatus.UNKNOWN,
      publicCheckedAt: null,
      publicUrl: null,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
  });
});

describe('checkSupportAccess', () => {
  it('closed (accessEnabled: false) -> OK, not WARNING', () => {
    const r = checkSupportAccess({
      accessEnabled: false,
      accessExpiresAt: null,
      hasActiveAccessLog: false,
      connectedAt: null,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.OK);
    expect(r.code).toBe('ACCESS_CLOSED');
  });
  it('open, active log, expiring within 15 min -> WARNING / ACCESS_EXPIRING_SOON', () => {
    const r = checkSupportAccess({
      accessEnabled: true,
      accessExpiresAt: new Date(NOW.getTime() + 10 * MIN),
      hasActiveAccessLog: true,
      connectedAt: NOW,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.WARNING);
    expect(r.code).toBe('ACCESS_EXPIRING_SOON');
  });
  it('open, active log, more than 15 min left -> OK (spec exhaustiveness fix)', () => {
    const r = checkSupportAccess({
      accessEnabled: true,
      accessExpiresAt: new Date(NOW.getTime() + HOUR),
      hasActiveAccessLog: true,
      connectedAt: NOW,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.OK);
    expect(r.code).toBe('ACCESS_OPEN');
  });
  it('enabled but no active log -> UNKNOWN / ACCESS_STATE_INCONSISTENT', () => {
    const r = checkSupportAccess({
      accessEnabled: true,
      accessExpiresAt: null,
      hasActiveAccessLog: false,
      connectedAt: null,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).toBe('ACCESS_STATE_INCONSISTENT');
  });
  it('enabled, active log, but accessExpiresAt null -> UNKNOWN (spec exhaustiveness fix)', () => {
    const r = checkSupportAccess({
      accessEnabled: true,
      accessExpiresAt: null,
      hasActiveAccessLog: true,
      connectedAt: NOW,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).toBe('ACCESS_STATE_INCONSISTENT');
  });
});

describe('checkResources', () => {
  it('no live report -> UNKNOWN', () => {
    const r = checkResources({ hasLiveReport: false, cpuPercent: null, memPercent: null, diskPercent: null, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
  });
  it('79% -> OK (below warning threshold)', () => {
    const r = checkResources({ hasLiveReport: true, cpuPercent: 79, memPercent: 10, diskPercent: 10, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.OK);
  });
  it('80% -> WARNING (at warning threshold)', () => {
    const r = checkResources({ hasLiveReport: true, cpuPercent: 80, memPercent: 10, diskPercent: 10, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.WARNING);
    expect(r.code).toBe('RESOURCE_HIGH_USAGE');
  });
  it('94% -> WARNING (just below error threshold)', () => {
    const r = checkResources({ hasLiveReport: true, cpuPercent: 94, memPercent: 10, diskPercent: 10, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.WARNING);
  });
  it('95% -> ERROR (at error threshold)', () => {
    const r = checkResources({ hasLiveReport: true, cpuPercent: 95, memPercent: 10, diskPercent: 10, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('RESOURCE_CRITICAL');
  });
  it('names the specific resource in the message', () => {
    const r = checkResources({ hasLiveReport: true, cpuPercent: 10, memPercent: 10, diskPercent: 96, now: NOW });
    expect(r.message).toMatch(/disk/i);
  });
});

describe('checkTemplates', () => {
  it('no session -> UNKNOWN', () => {
    const r = checkTemplates({ hasSession: false, activeTemplateSlugs: ['a'], appliedTemplates: [], now: NOW });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
  });
  it('all active templates applied -> OK / TEMPLATES_COMPLETE', () => {
    const r = checkTemplates({
      hasSession: true,
      activeTemplateSlugs: ['a', 'b'],
      appliedTemplates: ['a', 'b', 'c'],
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.OK);
    expect(r.code).toBe('TEMPLATES_COMPLETE');
  });
  it('some active templates missing -> WARNING / TEMPLATES_PENDING', () => {
    const r = checkTemplates({
      hasSession: true,
      activeTemplateSlugs: ['a', 'b'],
      appliedTemplates: ['a'],
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.WARNING);
    expect(r.code).toBe('TEMPLATES_PENDING');
    expect(r.evidence).toMatchObject({ pendingTemplates: ['b'] });
  });
});

describe('checkAudit', () => {
  it('eventCount === 0 -> UNKNOWN', () => {
    const r = checkAudit({ eventCount: 0, lastEventAt: null, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
  });
  it('eventCount > 0 -> OK', () => {
    const r = checkAudit({ eventCount: 3, lastEventAt: NOW, now: NOW });
    expect(r.status).toBe(DiagnosticStatus.OK);
  });
});

describe('checkProvisioning', () => {
  it('no session -> UNKNOWN / NOT_PROVISIONED', () => {
    const r = checkProvisioning({
      hasSession: false,
      lastConnectedAt: null,
      installTokenExpiresAt: null,
      serviceStartConsentAt: null,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).toBe('NOT_PROVISIONED');
  });
  it('ever connected -> OK, regardless of current token state', () => {
    const r = checkProvisioning({
      hasSession: true,
      lastConnectedAt: NOW,
      installTokenExpiresAt: null,
      serviceStartConsentAt: null,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.OK);
  });
  it('never connected, install token still valid -> WARNING / INSTALL_PENDING', () => {
    const r = checkProvisioning({
      hasSession: true,
      lastConnectedAt: null,
      installTokenExpiresAt: new Date(NOW.getTime() + HOUR),
      serviceStartConsentAt: null,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.WARNING);
    expect(r.code).toBe('INSTALL_PENDING');
  });
  it('never connected, install token expired -> ERROR / INSTALL_EXPIRED', () => {
    const r = checkProvisioning({
      hasSession: true,
      lastConnectedAt: null,
      installTokenExpiresAt: new Date(NOW.getTime() - HOUR),
      serviceStartConsentAt: null,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.ERROR);
    expect(r.code).toBe('INSTALL_EXPIRED');
  });
  it('never connected, no token data at all -> UNKNOWN (spec exhaustiveness fix)', () => {
    const r = checkProvisioning({
      hasSession: true,
      lastConnectedAt: null,
      installTokenExpiresAt: null,
      serviceStartConsentAt: null,
      now: NOW,
    });
    expect(r.status).toBe(DiagnosticStatus.UNKNOWN);
    expect(r.code).toBe('PROVISIONING_STATE_UNKNOWN');
  });
  it('serviceStartConsentAt never changes the outcome (evidence only)', () => {
    const withConsent = checkProvisioning({
      hasSession: true,
      lastConnectedAt: null,
      installTokenExpiresAt: new Date(NOW.getTime() + HOUR),
      serviceStartConsentAt: NOW,
      now: NOW,
    });
    const withoutConsent = checkProvisioning({
      hasSession: true,
      lastConnectedAt: null,
      installTokenExpiresAt: new Date(NOW.getTime() + HOUR),
      serviceStartConsentAt: null,
      now: NOW,
    });
    expect(withConsent.status).toBe(withoutConsent.status);
    expect(withConsent.code).toBe(withoutConsent.code);
  });
});

describe('evidence allowlisting (spot check)', () => {
  it('checkServer evidence contains only the documented fields, nothing entity-shaped', () => {
    const r = checkServer({
      hasServer: true,
      status: ServerStatus.ONLINE,
      lastSeenAt: NOW,
      multiServerDetected: false,
      now: NOW,
    });
    expect(Object.keys(r.evidence ?? {}).sort()).toEqual([
      'lastSeenAt',
      'multiServerDetected',
      'status',
    ]);
  });
});

describe('checkServer multi-server evidence (§7)', () => {
  it('multiServerDetected: false does not change status, only evidence', () => {
    const single = checkServer({
      hasServer: true,
      status: ServerStatus.ONLINE,
      lastSeenAt: NOW,
      multiServerDetected: false,
      now: NOW,
    });
    expect(single.status).toBe(DiagnosticStatus.OK);
    expect(single.evidence).toMatchObject({ multiServerDetected: false });
  });

  it('multiServerDetected: true surfaces in evidence without affecting status', () => {
    const multi = checkServer({
      hasServer: true,
      status: ServerStatus.ONLINE,
      lastSeenAt: NOW,
      multiServerDetected: true,
      now: NOW,
    });
    expect(multi.status).toBe(DiagnosticStatus.OK);
    expect(multi.evidence).toMatchObject({ multiServerDetected: true });
  });
});
