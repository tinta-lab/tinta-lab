import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditLogService } from './audit-log.service';

// Standalone leaf module (no dependency on AccessModule/TintaCoreModule) so
// both can depend on the audit ledger without a circular import.
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
