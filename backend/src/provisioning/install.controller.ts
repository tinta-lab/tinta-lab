import { Controller, Get, Param } from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';

@Controller('install')
export class InstallController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  @Get(':token')
  getInstallConfig(@Param('token') token: string) {
    return this.provisioningService.getInstallConfig(token);
  }
}
