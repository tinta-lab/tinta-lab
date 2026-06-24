import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { ProvisioningService } from './provisioning.service';
import { ProvisionClientDto } from './dto/provision-client.dto';

@Controller('provisioning')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Post('client')
  @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
  async provisionClient(@Body() dto: ProvisionClientDto) {
    return this.provisioningService.provisionClient(dto as any);
  }
}
