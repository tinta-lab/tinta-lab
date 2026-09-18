import { Module } from '@nestjs/common';
import { ClientsModule } from '../clients/clients.module';
import { ServersModule } from '../servers/servers.module';
import { TintaCoreModule } from '../tinta-core/tinta-core.module';
import { AccessModule } from '../access/access.module';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';

// PHASE1_3_DIAGNOSTICS_SPEC.md §3: sits on top of these four existing
// modules the same way Customer360Module is planned to — none of the four
// import this one back, so there's no cycle to break with forwardRef().
@Module({
  imports: [ClientsModule, ServersModule, TintaCoreModule, AccessModule],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService],
})
export class DiagnosticsModule {}
