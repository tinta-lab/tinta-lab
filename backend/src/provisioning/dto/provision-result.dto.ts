// Response shape for POST /provisioning/client (ADMIN-only bootstrap flow).
// Was a plain TS interface — invisible to the Swagger CLI plugin, so this
// endpoint generated an empty/untyped OpenAPI response despite returning
// real data. Every field here is kept, including the secrets
// (agentToken/installToken/tunnelToken/agentInstallCommand): this endpoint's
// whole purpose is handing a freshly-provisioned client's bootstrap
// credentials to the caller, and it has two real consumers with different
// field needs — the admin Hubs wizard (frontend/src/app/dashboard/admin/hubs/page.tsx,
// reads only `installToken` today) and scripts/provision-client.sh (reads
// agentToken/clientId/dashboardUrl/installUrl/tunnelToken) — so trimming to
// "what one consumer currently uses" would silently break the other.
export class ProvisionResultDto {
  clientId: string;
  serverId: string;
  agentToken: string;
  installToken: string;
  installUrl: string;
  tunnelToken: string | null;
  subdomain: string;
  dashboardUrl: string;
  agentInstallCommand: string;
}
