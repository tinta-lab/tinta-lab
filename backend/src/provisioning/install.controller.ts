import { Controller, Get, Post, Param, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ProvisioningService } from './provisioning.service';

@Controller('install')
export class InstallController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  // Public + unauthenticated by design (the installer has no token of its own
  // yet), but it hands back a live long-lived agent JWT — tighten beyond the
  // global default so the single-use install token can't be brute-forced.
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
