import { Controller, Get, Post, Param, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProvisioningService } from './provisioning.service';

@Controller('install')
export class InstallController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  // Browser-only, non-consuming. Must be registered before ':token' so Nest
  // doesn't route "preview" itself into the :token param.
  @Get(':token/preview')
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  getInstallPreview(@Param('token') token: string) {
    return this.provisioningService.getInstallPreview(token);
  }

  // Agent-only by design: single-use, hands back a live long-lived agent
  // JWT — tighten beyond the global default so the install token can't be
  // brute-forced. The browser must never call this directly (see
  // getInstallPreview): doing so consumes the token before the Agent can.
  @Get(':token')
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  getInstallConfig(@Param('token') token: string) {
    return this.provisioningService.getInstallConfig(token);
  }

  // Must be called (and succeed) before GET :token will reveal anything —
  // see AgentSession.serviceStartConsentAt.
  @Post(':token/consent')
  @HttpCode(200)
  @Throttle({ default: { ttl: 900_000, limit: 10 } })
  async confirmConsent(@Param('token') token: string) {
    await this.provisioningService.confirmInstallConsent(token);
    return { ok: true };
  }
}
