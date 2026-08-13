import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

// Before this existed, an unhandled exception was only visible to whoever
// happened to be tailing `pm2 logs` at the time — no consistent response
// shape, and no single hook to wire up alerting (Sentry, etc.) later. Nest's
// own default filter is safe (doesn't leak stack traces), just silent.
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

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
      // Hook for Sentry/monitoring once one is wired up:
      // Sentry.captureException(exception);
    }

    res.status(status).json({
      statusCode: status,
      message: isHttpException ? exception.message : 'Internal server error',
    });
  }
}
