import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomBytes } from 'crypto';

export interface ProvisionResult {
  tunnelId: string;
  tunnelToken: string;
  cfDnsRecordId: string;
  cfAccessAppId: string | null;
}

/** Generates a cryptographically random 6-char alphanumeric hub ID (e.g. "a7f3k9") */
export function generateHubId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no confusable chars (0/O, 1/I/l)
  return Array.from(randomBytes(6)).map(b => chars[b % chars.length]).join('');
}

@Injectable()
export class CloudflareService {
  private readonly logger = new Logger(CloudflareService.name);
  private readonly http: AxiosInstance | null = null;
  private readonly accountId: string | null;
  private readonly zoneId: string | null;
  private readonly baseDomain: string | null;
  private readonly reusablePolicyId: string | null;

  constructor(private config: ConfigService) {
    const token = config.get<string>('CLOUDFLARE_API_TOKEN');
    this.accountId = config.get<string>('CLOUDFLARE_ACCOUNT_ID') ?? null;
    this.zoneId = config.get<string>('CLOUDFLARE_ZONE_ID') ?? null;
    this.baseDomain = config.get<string>('CLOUDFLARE_BASE_DOMAIN') ?? null;
    this.reusablePolicyId = config.get<string>('CLOUDFLARE_ACCESS_POLICY_ID') ?? null;

    if (token && this.accountId && this.zoneId && this.baseDomain) {
      this.http = axios.create({
        baseURL: 'https://api.cloudflare.com/client/v4',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      this.logger.log('Cloudflare integration enabled');
    } else {
      this.logger.warn(
        'Cloudflare not configured — set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ' +
          'CLOUDFLARE_ZONE_ID, CLOUDFLARE_BASE_DOMAIN in .env to enable auto-provisioning',
      );
    }
  }

  get isEnabled(): boolean {
    return this.http !== null;
  }

  /**
   * Fully provisions a new server:
   * 1. Creates a Cloudflare Tunnel
   * 2. Configures ingress rule (hostname → HA)
   * 3. Creates CNAME DNS record
   * Returns tunnelId, tunnelToken (for cloudflared --token), dnsRecordId
   */
  async provisionServer(
    serverName: string,
    subdomain: string,
  ): Promise<ProvisionResult> {
    if (!this.http || !this.accountId || !this.zoneId || !this.baseDomain) {
      throw new Error('Cloudflare integration not configured');
    }

    // 1. Create tunnel
    const tunnelSecret = randomBytes(32).toString('base64');
    const createRes = await this.http.post(
      `/accounts/${this.accountId}/cfd_tunnel`,
      {
        name: `tinta-${serverName.toLowerCase().replace(/\s+/g, '-')}`,
        tunnel_secret: tunnelSecret,
      },
    );
    const tunnelId: string = createRes.data.result.id;
    this.logger.log(`Created Cloudflare tunnel ${tunnelId} for ${serverName}`);

    // 2. Configure ingress: hostname → Home Assistant port 8123
    await this.http.put(
      `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/configurations`,
      {
        config: {
          ingress: [
            { hostname: subdomain, service: 'http://homeassistant:8123' },
            { service: 'http_status:404' },
          ],
        },
      },
    );

    // 3. Get tunnel token (for cloudflared installation)
    const tokenRes = await this.http.get(
      `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}/token`,
    );
    const tunnelToken: string = tokenRes.data.result;

    // 4. Create CNAME DNS record
    const dnsName = this.getDnsName(subdomain);
    const dnsRes = await this.http.post(`/zones/${this.zoneId}/dns_records`, {
      type: 'CNAME',
      name: dnsName,
      content: `${tunnelId}.cfargotunnel.com`,
      proxied: true,
      ttl: 1,
    });
    const cfDnsRecordId: string = dnsRes.data.result.id;
    this.logger.log(
      `Created DNS record ${dnsName} → ${tunnelId}.cfargotunnel.com`,
    );

    // 5. Create Cloudflare Access Application (if reusable policy is configured)
    let cfAccessAppId: string | null = null;
    if (this.reusablePolicyId) {
      cfAccessAppId = await this.createAccessApp(subdomain, this.reusablePolicyId).catch(err => {
        this.logger.warn(`Access app creation failed (non-fatal): ${err.message}`);
        return null;
      });
    }

    return { tunnelId, tunnelToken, cfDnsRecordId, cfAccessAppId };
  }

  /**
   * Creates a Cloudflare Access Application for a hostname and attaches a reusable policy.
   * Returns the Access App ID (needed for cleanup).
   */
  async createAccessApp(hostname: string, policyId: string): Promise<string> {
    if (!this.http || !this.accountId) throw new Error('Cloudflare not configured');
    const displayName = hostname.split('.')[0]; // e.g. "hub-a7f3k9"
    const res = await this.http.post(
      `/accounts/${this.accountId}/access/apps`,
      {
        name: displayName,
        domain: hostname,
        type: 'self_hosted',
        session_duration: '720h',
        policies: [{ id: policyId }],
        allowed_idps: [],
        auto_redirect_to_identity: false,
      },
    );
    const appId: string = res.data.result.id;
    this.logger.log(`Created Access app ${appId} for ${hostname}`);
    return appId;
  }

  /**
   * Ensures a reusable "Client Standard Access" policy exists in the account.
   * Creates it if missing. Returns the policy ID.
   * Call this once during initial setup — then store the ID in CLOUDFLARE_ACCESS_POLICY_ID.
   */
  async ensureReusablePolicy(): Promise<string> {
    if (!this.http || !this.accountId) throw new Error('Cloudflare not configured');
    if (this.reusablePolicyId) return this.reusablePolicyId;

    const listRes = await this.http.get(`/accounts/${this.accountId}/access/policies`);
    const existing = listRes.data.result?.find((p: any) => p.name === 'Tinta Client Standard Access');
    if (existing) return existing.id as string;

    const createRes = await this.http.post(
      `/accounts/${this.accountId}/access/policies`,
      {
        name: 'Tinta Client Standard Access',
        decision: 'allow',
        session_duration: '720h',
        include: [{ email_domain: { domain: 'tinta-lab.de' } }],
      },
    );
    const policyId: string = createRes.data.result.id;
    this.logger.log(`Created reusable Access policy ${policyId} — save as CLOUDFLARE_ACCESS_POLICY_ID`);
    return policyId;
  }

  async deleteAccessApp(appId: string): Promise<void> {
    if (!this.http || !this.accountId) return;
    try {
      await this.http.delete(`/accounts/${this.accountId}/access/apps/${appId}`);
      this.logger.log(`Deleted Access app ${appId}`);
    } catch (err: any) {
      this.logger.error(`Failed to delete Access app ${appId}: ${err.message}`);
    }
  }

  async deleteTunnel(tunnelId: string): Promise<void> {
    if (!this.http || !this.accountId) return;
    try {
      await this.http.delete(
        `/accounts/${this.accountId}/cfd_tunnel/${tunnelId}`,
        {
          params: { force: true },
        },
      );
      this.logger.log(`Deleted Cloudflare tunnel ${tunnelId}`);
    } catch (err: any) {
      this.logger.error(`Failed to delete tunnel ${tunnelId}: ${err.message}`);
    }
  }

  async deleteDnsRecord(dnsRecordId: string): Promise<void> {
    if (!this.http || !this.zoneId) return;
    try {
      await this.http.delete(
        `/zones/${this.zoneId}/dns_records/${dnsRecordId}`,
      );
      this.logger.log(`Deleted DNS record ${dnsRecordId}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to delete DNS record ${dnsRecordId}: ${err.message}`,
      );
    }
  }

  private getDnsName(subdomain: string): string {
    if (this.baseDomain && subdomain.endsWith(`.${this.baseDomain}`)) {
      return subdomain.slice(0, -(this.baseDomain.length + 1));
    }
    return subdomain;
  }
}
