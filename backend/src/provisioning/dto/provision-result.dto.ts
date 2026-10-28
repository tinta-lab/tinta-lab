// Response shape for POST /provisioning/client (ADMIN-only bootstrap flow).
// Was a plain TS interface — invisible to the Swagger CLI plugin, so this
// endpoint generated an empty/untyped OpenAPI response despite returning
// real data. Every field here is kept, including the secrets
// (agentToken/installToken/tunnelToken/agentInstallCommand): this endpoint's
// whole purpose is handing a freshly-provisioned client's bootstrap
// credentials to the caller. Its UI consumer, the admin Hubs wizard
// (frontend/src/app/dashboard/admin/hubs/page.tsx), reads only
// installToken/installUrl, but the endpoint is also a documented API for
// curl/Swagger callers (scripts/provision-client.sh read the rest until it
// was removed 2026-10-28), so the shape stays as is.
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
