import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ProvisioningService } from './provisioning.service';
import type { ProvisionClientDto } from './provisioning.service';

@Controller('provisioning')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  /**
   * One-click: create client + server + Cloudflare tunnel + agent token + notification
   * POST /provisioning/client
   */
  @Post('client')
  async provisionClient(@Body() dto: Record<string, any>) {
    return this.provisioningService.provisionClient(dto as any);
  }
}
