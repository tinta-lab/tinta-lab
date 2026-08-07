import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessService } from './access.service';

@Injectable()
export class AccessScheduler {
  private readonly logger = new Logger(AccessScheduler.name);

  constructor(private accessService: AccessService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleExpiredAccess() {
    await this.accessService.checkAndRevokeExpired();
  }

  // GDPR retention: purge closed session logs past AUDIT_LOG_RETENTION_DAYS
  // (default 365). Skips open sessions and anything under a retention hold.
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleRetentionPurge() {
    const purged = await this.accessService.purgeExpiredLogs();
    if (purged > 0) {
      this.logger.log(`GDPR retention purge: removed ${purged} access log(s)`);
    }
  }
}
