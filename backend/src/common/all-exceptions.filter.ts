import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiError, ApiErrorCode } from './api-error';

// Before this existed, an unhandled exception was only visible to whoever
// happened to be tailing `pm2 logs` at the time — no consistent response
// shape, and no single hook to wire up alerting (Sentry, etc.) later. Nest's
// own default filter is safe (doesn't leak stack traces), just silent.
//
// `code` (2026-09-22 error contract, Phase 1): every response now carries a
// stable ApiErrorCode, not just a status + English message. An exception
// thrown as ApiError supplies its own specific code; anything else (the
// vast majority of existing `throw new ConflictException(...)` call sites,
// not yet migrated) gets a generic per-status fallback below — so the
// contract applies everywhere immediately, and call sites migrate to a
// specific code incrementally, only when something actually needs one
// (see api-error.ts's MIGRATION_NOTES). `message` stays English and is for
// logs/debugging only — frontend/src/lib/apiError.ts never renders it.
const DEFAULT_CODE_FOR_STATUS: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost): void {
    // Only handles HTTP — WS gateways (ServersGateway, TintaAgentGateway)
    // do their own try/catch around handler bodies and shouldn't route
    // through an HTTP response filter.
    if (host.getType() !== 'http') throw exception;

    const res = host.switchToHttp().getResponse<Response>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : 500;
    const isApiError = exception instanceof ApiError;
    const code: ApiErrorCode =
      isApiError ? exception.code : (DEFAULT_CODE_FOR_STATUS[status] ?? 'UNKNOWN_ERROR');

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Hook for Sentry/monitoring once one is wired up:
      // Sentry.captureException(exception);
    }

    res.status(status).json({
      statusCode: status,
      code,
      message: isHttpException ? exception.message : 'Internal server error',
      ...(isApiError && exception.details ? { details: exception.details } : {}),
    });
  }
}
