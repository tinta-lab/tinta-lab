import { ForbiddenException, Injectable } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import { ServersService } from '../servers/servers.service';
import { TintaCoreService } from '../tinta-core/tinta-core.service';
import { AccessService } from '../access/access.service';
import { GoldenTemplateService } from '../tinta-core/golden-template.service';
import { Server, ServerPublicStatus } from '../servers/entities/server.entity';
import { UserRole } from '../users/entities/user.entity';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ClientDiagnosticsDto } from './dto/client-diagnostics.dto';
import { DiagnosticCheckDto } from './dto/diagnostic-check.dto';
import { aggregateStatus } from './aggregate-status';
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

// ServersService.findByClientId's actual return value has a computed
// publicUrl field (see servers.service.ts's `{ ...server, publicUrl:
// this.getPublicHostname(server) }` mapping) that its own type annotation
// (Promise<Server[]>) doesn't declare — a pre-existing gap in that method's
// signature, not something this phase's scope covers fixing. This is the
// narrowest fix that doesn't touch servers.service.ts.
type ServerWithPublicUrl = Server & { publicUrl: string | null };

@Injectable()
export class DiagnosticsService {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly serversService: ServersService,
    private readonly tintaCoreService: TintaCoreService,
    private readonly accessService: AccessService,
    private readonly templateService: GoldenTemplateService,
  ) {}

  async getClientDiagnostics({
    clientId,
    requester,
  }: {
    clientId: string;
    requester: AuthenticatedUser;
  }): Promise<ClientDiagnosticsDto> {
    const now = new Date();

    // client + servers have no dependency on each other (both keyed only by
    // clientId) — loaded in parallel. clientsService.findById throws
    // NotFoundException (-> 404) before any ownership check runs, per
    // PHASE1_3_DIAGNOSTICS_SPEC.md §3's "resolve client, 404, then
    // authorization" ordering: Promise.all rejects with that 404 as soon as
    // it settles, before assertCanView is ever reached.
    const [client, servers] = await Promise.all([
      this.clientsService.findById(clientId),
      this.serversService.findByClientId(clientId) as Promise<
        ServerWithPublicUrl[]
      >,
    ]);

    // assertCanView takes the already-loaded servers list rather than
    // re-querying them itself (spec §3 illustrates the seam as
    // assertCanView(clientId, requester) calling serversService
    // internally) — an intentional, disclosed adaptation to avoid a
    // redundant identical query in the one caller that exists today. The
    // seam itself (one place enforcing ownership) is unchanged, and this is
    // still where D2's eventual resolution would update the rule.
    this.assertCanView(requester, servers);

    const server = this.pickRepresentativeServer(servers);
    const multiServerDetected = servers.length > 1;

    // Independent reads once the representative server is known — none of
    // these five depend on each other, so they run in parallel.
    const [sessionSummary, liveDiagnostics, activeAccessLog, accessLogs, templates] =
      await Promise.all([
        this.tintaCoreService.getSessionSummary(clientId),
        this.tintaCoreService.getDiagnostics(clientId),
        server
          ? this.accessService.getActiveAccessForServer(server.id)
          : Promise.resolve(null),
        this.accessService.getLogsForClient(clientId),
        this.templateService.findAll(),
      ]);

    const hasSession = sessionSummary !== null;
    const hasLiveReport =
      liveDiagnostics.agentOnline && liveDiagnostics.report !== null;
    const report = hasLiveReport ? liveDiagnostics.report! : null;

    const checks: DiagnosticCheckDto[] = [
      checkClient({ isActive: client.user.isActive, now }),

      checkHub({
        hasServer: server !== null,
        hubId: server?.hubId ?? null,
        now,
      }),

      checkServer({
        hasServer: server !== null,
        status: server?.status ?? null,
        lastSeenAt: server?.lastSeenAt ?? null,
        multiServerDetected,
        now,
      }),

      checkAgent({
        hasSession,
        agentOnline: liveDiagnostics.agentOnline,
        hasReport: report !== null,
        lastConnectedAt: sessionSummary?.lastConnectedAt ?? null,
        lastHeartbeatAt: sessionSummary?.lastHeartbeatAt ?? null,
        agentVersion: sessionSummary?.agentVersion ?? null,
        now,
      }),

      // PHASE1_3_DIAGNOSTICS_SPEC.md §0 item 4: cpuPercent/memPercent/
      // diskPercent come from the live report only, never the stale
      // AgentSession.metrics snapshot — haVersion falls back to the
      // session's stale value only because there is no live-report
      // equivalent of "last known HA version" otherwise.
      checkHomeAssistant({
        hasLiveReport,
        haConnected: report?.haConnected ?? null,
        haVersion: report?.haVersion ?? sessionSummary?.haVersion ?? null,
        now,
      }),

      checkPublicConnectivity({
        publicStatus: server?.publicStatus ?? ServerPublicStatus.UNKNOWN,
        publicCheckedAt: server?.publicCheckedAt ?? null,
        publicUrl: server?.publicUrl ?? null,
        now,
      }),

      checkSupportAccess({
        accessEnabled: server?.accessEnabled ?? false,
        accessExpiresAt: server?.accessExpiresAt ?? null,
        hasActiveAccessLog: activeAccessLog !== null,
        connectedAt: activeAccessLog?.connectedAt ?? null,
        now,
      }),

      checkResources({
        hasLiveReport,
        cpuPercent: report?.cpuPercent ?? null,
        memPercent: report?.memPercent ?? null,
        diskPercent: report?.diskPercent ?? null,
        now,
      }),

      checkTemplates({
        hasSession,
        activeTemplateSlugs: templates.map((t) => t.slug),
        appliedTemplates: sessionSummary?.appliedTemplates ?? [],
        now,
      }),

      // eventCount is this client's AccessLog count (§0 item 3 — never
      // AuditLogService.verifyChain()); getLogsForClient is already
      // ordered createdAt DESC, so the first row's grantedAt is the most
      // recent access-related event for this client.
      checkAudit({
        eventCount: accessLogs.length,
        lastEventAt: accessLogs[0]?.grantedAt ?? null,
        now,
      }),

      checkProvisioning({
        hasSession,
        lastConnectedAt: sessionSummary?.lastConnectedAt ?? null,
        installTokenExpiresAt: sessionSummary?.installTokenExpiresAt ?? null,
        serviceStartConsentAt: sessionSummary?.serviceStartConsentAt ?? null,
        now,
      }),
    ];

    return {
      clientId,
      overallStatus: aggregateStatus(checks),
      checkedAt: now,
      checks,
      client: {
        id: client.id,
        firstName: client.user.firstName,
        lastName: client.user.lastName,
        email: client.user.email,
        isInstalled: client.isInstalled,
      },
      server: server
        ? {
            id: server.id,
            name: server.name,
            subdomain: server.subdomain,
            status: server.status,
            publicStatus: server.publicStatus,
          }
        : null,
      hub: server
        ? {
            // Server.hubId is the public-hostname id, not a separate Hub
            // entity's id — this codebase has no standalone Hub table
            // (HubViewDto is itself a Server+AgentSession projection).
            // Falls back to the server's own id only for the rare case a
            // server exists but hasn't been assigned a hubId yet (the
            // `hub` check's own HUB_NOT_LINKED case) — agent/HA data is
            // still meaningful even then, so this ref stays non-null.
            id: server.hubId ?? server.id,
            agentOnline: liveDiagnostics.agentOnline,
            agentVersion: sessionSummary?.agentVersion ?? null,
            haVersion: report?.haVersion ?? sessionSummary?.haVersion ?? null,
          }
        : null,
    };
  }

  private assertCanView(
    requester: AuthenticatedUser,
    servers: Server[],
  ): void {
    if (requester.role === UserRole.ADMIN) return;
    if (requester.role === UserRole.SUPPORT) {
      if (servers.some((s) => s.accessEnabled)) return;
      throw new ForbiddenException(
        "Access to this client's diagnostics is not currently granted",
      );
    }
    // Unreachable via HTTP — RolesGuard/@Roles(...DIAGNOSTICS_ROLES) already
    // rejects any other role before the controller method runs. Kept as a
    // defensive default rather than an unchecked fallthrough, per spec §3.
    throw new ForbiddenException();
  }

  // PHASE1_3_DIAGNOSTICS_SPEC.md §7: deterministic tie-break, not "whichever
  // one has accessEnabled" or any other condition-dependent rule — the same
  // client's Diagnostics must not silently point at a different server from
  // one call to the next as access state changes.
  private pickRepresentativeServer(
    servers: ServerWithPublicUrl[],
  ): ServerWithPublicUrl | null {
    if (servers.length === 0) return null;
    const sorted = [...servers].sort((a, b) => {
      const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
      if (byCreatedAt !== 0) return byCreatedAt;
      return a.id.localeCompare(b.id);
    });
    return sorted[0];
  }
}
