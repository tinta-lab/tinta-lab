import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessService } from './access.service';

@Injectable()
export class AccessScheduler {
  constructor(private accessService: AccessService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredAccess() {
    await this.accessService.checkAndRevokeExpired();
  }
}
