import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ServersService } from './servers.service';

@Injectable()
export class ServersPublicStatusScheduler {
  private readonly logger = new Logger(ServersPublicStatusScheduler.name);

  constructor(private serversService: ServersService) {}

  @Cron('0 */2 * * * *')
  async handlePublicStatusCheck() {
    try {
      await this.serversService.checkPublicReachability();
    } catch (err: any) {
      this.logger.error(`Public reachability check failed: ${err.message}`);
    }
  }
}
