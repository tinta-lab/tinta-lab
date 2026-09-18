import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { DIAGNOSTICS_ROLES } from '../auth/role-groups';
import { DiagnosticsService } from './diagnostics.service';
import { ClientDiagnosticsDto } from './dto/client-diagnostics.dto';

// PHASE1_3_DIAGNOSTICS_SPEC.md §3. Shares the /clients route prefix with
// ClientsController (and, once it exists, Customer360Controller) without
// colliding — Nest allows this as long as concrete paths differ.
@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DiagnosticsController {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  // Only auth/role gating and delegation here — ownership lives in
  // DiagnosticsService.assertCanView so it applies uniformly to every
  // future caller, not just this HTTP route (§3).
  @Get(':clientId/diagnostics')
  @Roles(...DIAGNOSTICS_ROLES)
  async getClientDiagnostics(
    @Param('clientId') clientId: string,
    @CurrentUser() requester: AuthenticatedUser,
  ): Promise<ClientDiagnosticsDto> {
    return this.diagnosticsService.getClientDiagnostics({
      clientId,
      requester,
    });
  }
}
