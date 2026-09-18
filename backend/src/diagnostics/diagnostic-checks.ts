// PHASE1_3_DIAGNOSTICS_SPEC.md §5 (as amended by the exhaustiveness fixes
// in this same commit's spec update). Each function here is pure: no DB, no
// HTTP/WS, no Nest service calls, no global state — every input it needs
// arrives as an argument, and it returns nothing but a DiagnosticCheckDto.
// DiagnosticsService (§11 step 4) is responsible for gathering the real
// inputs and calling these; nothing in this file knows where its inputs
// came from.
//
// Governing principle for every branch below (§5): UNKNOWN = insufficient
// evidence, ERROR = evidence of failure, WARNING = evidence of a degraded/
// attention-needed state, OK = evidence sufficient to call it healthy. A
// missing case is a defect to fix, not a default to assume.
import { DiagnosticCheckKey } from './dto/diagnostic-check-key.enum';
import { DiagnosticStatus } from './dto/diagnostic-status.enum';
import { DiagnosticCheckDto } from './dto/diagnostic-check.dto';
import {
  ServerStatus,
  ServerPublicStatus,
} from '../servers/entities/server.entity';

const SERVER_RECENTLY_OFFLINE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const ACCESS_EXPIRING_SOON_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RESOURCE_WARNING_THRESHOLD = 80;
const RESOURCE_ERROR_THRESHOLD = 95;

function check(
  key: DiagnosticCheckKey,
  status: DiagnosticStatus,
  code: string,
  title: string,
  message: string,
  checkedAt: Date,
  evidence: Record<string, unknown> | null,
): DiagnosticCheckDto {
  return { key, status, code, title, message, checkedAt, evidence };
}

// ─── client ─────────────────────────────────────────────────────────────

export interface CheckClientInput {
  isActive: boolean;
  now: Date;
}

export function checkClient(input: CheckClientInput): DiagnosticCheckDto {
  const evidence = { isActive: input.isActive };
  if (input.isActive) {
    return check(
      DiagnosticCheckKey.CLIENT,
      DiagnosticStatus.OK,
      'CLIENT_ACTIVE',
      'Client active',
      'The client account is active.',
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.CLIENT,
    DiagnosticStatus.ERROR,
    'CLIENT_INACTIVE',
    'Client inactive',
    'The client account is deactivated.',
    input.now,
    evidence,
  );
}

// ─── hub ────────────────────────────────────────────────────────────────

export interface CheckHubInput {
  hasServer: boolean;
  hubId: string | null;
  now: Date;
}

export function checkHub(input: CheckHubInput): DiagnosticCheckDto {
  const evidence = { hasServer: input.hasServer, hubId: input.hubId };
  if (!input.hasServer) {
    return check(
      DiagnosticCheckKey.HUB,
      DiagnosticStatus.UNKNOWN,
      'NO_SERVER',
      'No server',
      'This client has no server yet.',
      input.now,
      evidence,
    );
  }
  if (!input.hubId) {
    return check(
      DiagnosticCheckKey.HUB,
      DiagnosticStatus.ERROR,
      'HUB_NOT_LINKED',
      'Hub not linked',
      "This client's server has no hub linked.",
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.HUB,
    DiagnosticStatus.OK,
    'HUB_LINKED',
    'Hub linked',
    'A hub is linked to this server.',
    input.now,
    evidence,
  );
}

// ─── server ─────────────────────────────────────────────────────────────

export interface CheckServerInput {
  hasServer: boolean;
  status: ServerStatus | null;
  lastSeenAt: Date | null;
  // PHASE1_3_DIAGNOSTICS_SPEC.md §7 — whether the caller's deterministic
  // representative-server tie-break actually had more than one candidate.
  // Purely a passthrough into evidence; never affects this check's status.
  multiServerDetected: boolean;
  now: Date;
}

export function checkServer(input: CheckServerInput): DiagnosticCheckDto {
  const evidence = {
    status: input.status,
    lastSeenAt: input.lastSeenAt,
    multiServerDetected: input.multiServerDetected,
  };
  if (!input.hasServer) {
    return check(
      DiagnosticCheckKey.SERVER,
      DiagnosticStatus.UNKNOWN,
      'NO_SERVER',
      'No server',
      'This client has no server yet.',
      input.now,
      evidence,
    );
  }
  if (input.status === ServerStatus.ONLINE) {
    return check(
      DiagnosticCheckKey.SERVER,
      DiagnosticStatus.OK,
      'SERVER_ONLINE',
      'Server online',
      'The server is online.',
      input.now,
      evidence,
    );
  }
  if (input.status === ServerStatus.UNKNOWN) {
    return check(
      DiagnosticCheckKey.SERVER,
      DiagnosticStatus.UNKNOWN,
      'SERVER_STATUS_UNKNOWN',
      'Server status unknown',
      "The server's online/offline status has not been confirmed.",
      input.now,
      evidence,
    );
  }
  // ServerStatus.OFFLINE
  const recentlyOffline =
    input.lastSeenAt !== null &&
    input.now.getTime() - input.lastSeenAt.getTime() <=
      SERVER_RECENTLY_OFFLINE_WINDOW_MS;
  if (recentlyOffline) {
    return check(
      DiagnosticCheckKey.SERVER,
      DiagnosticStatus.WARNING,
      'SERVER_RECENTLY_OFFLINE',
      'Server recently offline',
      'The server went offline within the last 24 hours.',
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.SERVER,
    DiagnosticStatus.ERROR,
    'SERVER_OFFLINE',
    'Server offline',
    'The server has been offline for more than 24 hours.',
    input.now,
    evidence,
  );
}

// ─── agent ──────────────────────────────────────────────────────────────

export interface CheckAgentInput {
  hasSession: boolean;
  agentOnline: boolean;
  hasReport: boolean;
  lastConnectedAt: Date | null;
  lastHeartbeatAt: Date | null;
  agentVersion: string | null;
  now: Date;
}

export function checkAgent(input: CheckAgentInput): DiagnosticCheckDto {
  const evidence = {
    lastConnectedAt: input.lastConnectedAt,
    lastHeartbeatAt: input.lastHeartbeatAt,
    agentVersion: input.agentVersion,
    connectionState: input.agentOnline ? 'connected' : 'disconnected',
  };
  if (!input.hasSession) {
    return check(
      DiagnosticCheckKey.AGENT,
      DiagnosticStatus.UNKNOWN,
      'AGENT_NOT_PROVISIONED',
      'Agent not provisioned',
      'No agent has ever been provisioned for this client.',
      input.now,
      evidence,
    );
  }
  if (!input.agentOnline) {
    return check(
      DiagnosticCheckKey.AGENT,
      DiagnosticStatus.ERROR,
      'AGENT_OFFLINE',
      'Agent offline',
      'No active WebSocket connection to the agent.',
      input.now,
      evidence,
    );
  }
  if (!input.hasReport) {
    return check(
      DiagnosticCheckKey.AGENT,
      DiagnosticStatus.WARNING,
      'AGENT_UNRESPONSIVE',
      'Agent unresponsive',
      'The agent is connected but did not answer the diagnostics request in time.',
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.AGENT,
    DiagnosticStatus.OK,
    'AGENT_ONLINE',
    'Agent online',
    'The agent is connected and responding.',
    input.now,
    evidence,
  );
}

// ─── homeAssistant ──────────────────────────────────────────────────────

export interface CheckHomeAssistantInput {
  hasLiveReport: boolean;
  haConnected: boolean | null;
  haVersion: string | null;
  now: Date;
}

// Must only be evaluated relative to the agent's own live report — never
// independently, and never as a copy/escalation of the `agent` check's own
// ERROR/WARNING. See §5's independence principle.
export function checkHomeAssistant(
  input: CheckHomeAssistantInput,
): DiagnosticCheckDto {
  const evidence = {
    haVersion: input.haVersion,
    haConnected: input.haConnected,
  };
  if (!input.hasLiveReport) {
    return check(
      DiagnosticCheckKey.HOME_ASSISTANT,
      DiagnosticStatus.UNKNOWN,
      'HA_NOT_CHECKED',
      'Home Assistant not checked',
      'Home Assistant connectivity cannot be checked while the agent is offline or unresponsive.',
      input.now,
      evidence,
    );
  }
  if (input.haConnected) {
    return check(
      DiagnosticCheckKey.HOME_ASSISTANT,
      DiagnosticStatus.OK,
      'HA_CONNECTED',
      'Home Assistant connected',
      'The agent reports an active connection to Home Assistant.',
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.HOME_ASSISTANT,
    DiagnosticStatus.ERROR,
    'HA_API_UNAVAILABLE',
    'Home Assistant unavailable',
    "The agent reports it cannot reach Home Assistant's API.",
    input.now,
    evidence,
  );
}

// ─── cloudflare (public connectivity) ──────────────────────────────────

export interface CheckPublicConnectivityInput {
  publicStatus: ServerPublicStatus;
  publicCheckedAt: Date | null;
  publicUrl: string | null;
  now: Date;
}

// PHASE1_3_DIAGNOSTICS_SPEC.md §0 item 1: this is a passthrough of
// Server.publicStatus's own 3-state enum, an indirect end-to-end public
// reachability signal — never a Cloudflare API/control-plane read, and
// never reinterpreted into a different meaning than the enum already has.
export function checkPublicConnectivity(
  input: CheckPublicConnectivityInput,
): DiagnosticCheckDto {
  const evidence = {
    publicStatus: input.publicStatus,
    publicCheckedAt: input.publicCheckedAt,
    publicUrl: input.publicUrl,
  };
  if (input.publicStatus === ServerPublicStatus.REACHABLE) {
    return check(
      DiagnosticCheckKey.CLOUDFLARE,
      DiagnosticStatus.OK,
      'PUBLIC_URL_REACHABLE',
      'Public URL reachable',
      "The client's public URL answered the last reachability probe.",
      input.now,
      evidence,
    );
  }
  if (input.publicStatus === ServerPublicStatus.UNREACHABLE) {
    return check(
      DiagnosticCheckKey.CLOUDFLARE,
      DiagnosticStatus.ERROR,
      'PUBLIC_URL_UNREACHABLE',
      'Public URL unreachable',
      "The client's public URL did not answer the last reachability probe.",
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.CLOUDFLARE,
    DiagnosticStatus.UNKNOWN,
    'PUBLIC_URL_NOT_CHECKED',
    'Public URL not checked',
    'The public URL has not been probed yet, or is not configured.',
    input.now,
    evidence,
  );
}

// ─── supportAccess ──────────────────────────────────────────────────────

export interface CheckSupportAccessInput {
  accessEnabled: boolean;
  accessExpiresAt: Date | null;
  hasActiveAccessLog: boolean;
  connectedAt: Date | null;
  now: Date;
}

// Describes the current access state; it is not a health assertion. Closed
// access (accessEnabled: false) is the healthy default state, not merely
// "not yet a problem" — support access is opt-in. Do not turn
// accessEnabled: false into a WARNING later.
export function checkSupportAccess(
  input: CheckSupportAccessInput,
): DiagnosticCheckDto {
  const evidence = {
    accessEnabled: input.accessEnabled,
    accessExpiresAt: input.accessExpiresAt,
    activeSince: input.connectedAt,
  };
  if (!input.accessEnabled) {
    return check(
      DiagnosticCheckKey.SUPPORT_ACCESS,
      DiagnosticStatus.OK,
      'ACCESS_CLOSED',
      'Access closed',
      'Support access is currently closed.',
      input.now,
      evidence,
    );
  }
  if (!input.hasActiveAccessLog || input.accessExpiresAt === null) {
    // accessEnabled implies an active grant with a concrete expiry
    // (AccessService.grantAccess always computes one — there is no
    // indefinite-grant path). Either condition failing is a data
    // inconsistency, not a confirmable state either way.
    return check(
      DiagnosticCheckKey.SUPPORT_ACCESS,
      DiagnosticStatus.UNKNOWN,
      'ACCESS_STATE_INCONSISTENT',
      'Access state inconsistent',
      'Access is marked enabled but no active, well-formed access session was found.',
      input.now,
      evidence,
    );
  }
  const msUntilExpiry = input.accessExpiresAt.getTime() - input.now.getTime();
  if (msUntilExpiry <= ACCESS_EXPIRING_SOON_WINDOW_MS) {
    return check(
      DiagnosticCheckKey.SUPPORT_ACCESS,
      DiagnosticStatus.WARNING,
      'ACCESS_EXPIRING_SOON',
      'Access expiring soon',
      'Support access will close within 15 minutes.',
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.SUPPORT_ACCESS,
    DiagnosticStatus.OK,
    'ACCESS_OPEN',
    'Access open',
    'Support access is open with time remaining.',
    input.now,
    evidence,
  );
}

// ─── resources ──────────────────────────────────────────────────────────

export interface CheckResourcesInput {
  hasLiveReport: boolean;
  cpuPercent: number | null;
  memPercent: number | null;
  diskPercent: number | null;
  now: Date;
}

export function checkResources(
  input: CheckResourcesInput,
): DiagnosticCheckDto {
  const evidence = {
    cpuPercent: input.cpuPercent,
    memPercent: input.memPercent,
    diskPercent: input.diskPercent,
  };
  if (
    !input.hasLiveReport ||
    input.cpuPercent === null ||
    input.memPercent === null ||
    input.diskPercent === null
  ) {
    return check(
      DiagnosticCheckKey.RESOURCES,
      DiagnosticStatus.UNKNOWN,
      'RESOURCES_NOT_CHECKED',
      'Resources not checked',
      'Resource usage cannot be checked while the agent is offline or unresponsive.',
      input.now,
      evidence,
    );
  }

  const readings: Array<{ name: string; value: number }> = [
    { name: 'CPU', value: input.cpuPercent },
    { name: 'memory', value: input.memPercent },
    { name: 'disk', value: input.diskPercent },
  ];
  const critical = readings.filter((r) => r.value >= RESOURCE_ERROR_THRESHOLD);
  if (critical.length > 0) {
    const names = critical.map((r) => `${r.name} ${r.value}%`).join(', ');
    return check(
      DiagnosticCheckKey.RESOURCES,
      DiagnosticStatus.ERROR,
      'RESOURCE_CRITICAL',
      'Resource usage critical',
      `Critically high usage: ${names}.`,
      input.now,
      evidence,
    );
  }
  const high = readings.filter((r) => r.value >= RESOURCE_WARNING_THRESHOLD);
  if (high.length > 0) {
    const names = high.map((r) => `${r.name} ${r.value}%`).join(', ');
    return check(
      DiagnosticCheckKey.RESOURCES,
      DiagnosticStatus.WARNING,
      'RESOURCE_HIGH_USAGE',
      'Resource usage high',
      `High usage: ${names}.`,
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.RESOURCES,
    DiagnosticStatus.OK,
    'RESOURCES_NORMAL',
    'Resources normal',
    'CPU, memory, and disk usage are all within normal range.',
    input.now,
    evidence,
  );
}

// ─── templates ──────────────────────────────────────────────────────────

export interface CheckTemplatesInput {
  hasSession: boolean;
  activeTemplateSlugs: string[];
  appliedTemplates: string[];
  now: Date;
}

export function checkTemplates(
  input: CheckTemplatesInput,
): DiagnosticCheckDto {
  if (!input.hasSession) {
    return check(
      DiagnosticCheckKey.TEMPLATES,
      DiagnosticStatus.UNKNOWN,
      'TEMPLATES_NOT_PROVISIONED',
      'Templates not checked',
      'No agent session exists to check applied templates against.',
      input.now,
      { appliedTemplates: input.appliedTemplates, pendingTemplates: [] },
    );
  }
  const applied = new Set(input.appliedTemplates);
  const pending = input.activeTemplateSlugs.filter(
    (slug) => !applied.has(slug),
  );
  const evidence = {
    appliedTemplates: input.appliedTemplates,
    pendingTemplates: pending,
  };
  if (pending.length === 0) {
    return check(
      DiagnosticCheckKey.TEMPLATES,
      DiagnosticStatus.OK,
      'TEMPLATES_COMPLETE',
      'Templates applied',
      'All active default templates are applied.',
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.TEMPLATES,
    DiagnosticStatus.WARNING,
    'TEMPLATES_PENDING',
    'Templates pending',
    `${pending.length} default template(s) not yet applied.`,
    input.now,
    evidence,
  );
}

// ─── audit ──────────────────────────────────────────────────────────────

export interface CheckAuditInput {
  eventCount: number;
  lastEventAt: Date | null;
  now: Date;
}

// PHASE1_3_DIAGNOSTICS_SPEC.md §0 item 3: does not evaluate hash-chain
// integrity (that stays global, ADMIN-only, GET /access/audit-verify) —
// this is only "does this client have any recorded access history at all".
export function checkAudit(input: CheckAuditInput): DiagnosticCheckDto {
  const evidence = {
    lastEventAt: input.lastEventAt,
    eventCount: input.eventCount,
  };
  if (input.eventCount > 0) {
    return check(
      DiagnosticCheckKey.AUDIT,
      DiagnosticStatus.OK,
      'AUDIT_HAS_EVENTS',
      'Audit trail present',
      'This client has recorded access history.',
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.AUDIT,
    DiagnosticStatus.UNKNOWN,
    'AUDIT_NO_EVENTS',
    'No audit events',
    'This client has no recorded access history yet.',
    input.now,
    evidence,
  );
}

// ─── provisioning ───────────────────────────────────────────────────────

export interface CheckProvisioningInput {
  hasSession: boolean;
  lastConnectedAt: Date | null;
  installTokenExpiresAt: Date | null;
  serviceStartConsentAt: Date | null;
  now: Date;
}

export function checkProvisioning(
  input: CheckProvisioningInput,
): DiagnosticCheckDto {
  // serviceStartConsentAt is evidence only — PHASE1_3_DIAGNOSTICS_SPEC.md
  // §0 item 2 — it never drives the status below.
  const evidence = {
    installTokenExpiresAt: input.installTokenExpiresAt,
    serviceStartConsentAt: input.serviceStartConsentAt,
    lastConnectedAt: input.lastConnectedAt,
  };
  if (!input.hasSession) {
    return check(
      DiagnosticCheckKey.PROVISIONING,
      DiagnosticStatus.UNKNOWN,
      'NOT_PROVISIONED',
      'Not provisioned',
      'No agent session exists for this client.',
      input.now,
      evidence,
    );
  }
  if (input.lastConnectedAt !== null) {
    return check(
      DiagnosticCheckKey.PROVISIONING,
      DiagnosticStatus.OK,
      'PROVISIONING_CONNECTED',
      'Provisioning complete',
      'The agent has connected at least once.',
      input.now,
      evidence,
    );
  }
  if (input.installTokenExpiresAt === null) {
    return check(
      DiagnosticCheckKey.PROVISIONING,
      DiagnosticStatus.UNKNOWN,
      'PROVISIONING_STATE_UNKNOWN',
      'Provisioning state unknown',
      'The agent has never connected and no install-token data is available.',
      input.now,
      evidence,
    );
  }
  if (input.installTokenExpiresAt.getTime() > input.now.getTime()) {
    return check(
      DiagnosticCheckKey.PROVISIONING,
      DiagnosticStatus.WARNING,
      'INSTALL_PENDING',
      'Installation pending',
      'The install token is still valid but the agent has not connected yet.',
      input.now,
      evidence,
    );
  }
  return check(
    DiagnosticCheckKey.PROVISIONING,
    DiagnosticStatus.ERROR,
    'INSTALL_EXPIRED',
    'Installation expired',
    'The install token expired before the agent ever connected.',
    input.now,
    evidence,
  );
}
