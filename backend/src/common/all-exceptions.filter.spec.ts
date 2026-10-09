import { ArgumentsHost, BadRequestException, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ApiError } from './api-error';

// Regression coverage for the 2026-09-22 error contract (Phase 1): every
// response must carry a stable `code`, whether or not the thrown exception
// is an ApiError — this is what lets the frontend stop string-matching on
// English `message` text (see api-error.ts's MIGRATION_NOTES for the real
// bug this fixes: CLIENT_EMAIL_EXISTS was previously matched by comparing
// against the literal string 'Email already exists').
describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jsonSpy = jest.fn();
    statusSpy = jest.fn(() => ({ json: jsonSpy }));
    host = {
      getType: () => 'http',
      switchToHttp: () => ({ getResponse: () => ({ status: statusSpy }) }),
    } as unknown as ArgumentsHost;
  });

  it('gives an ApiError its own specific code', () => {
    filter.catch(
      new ApiError(409, 'CLIENT_EMAIL_EXISTS', 'Client with this email already exists'),
      host,
    );
    expect(statusSpy).toHaveBeenCalledWith(409);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'CLIENT_EMAIL_EXISTS',
      message: 'Client with this email already exists',
    });
  });

  it('includes details when the ApiError carries them', () => {
    filter.catch(
      new ApiError(409, 'AGENT_DOWNGRADE_REJECTED', 'Refusing to downgrade', {
        installed: '2026.9.2',
        requested: '2026.8.3',
      }),
      host,
    );
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'AGENT_DOWNGRADE_REJECTED',
        details: { installed: '2026.9.2', requested: '2026.8.3' },
      }),
    );
  });

  it('falls back to a generic per-status code for an un-migrated ConflictException', () => {
    filter.catch(new ConflictException('some other conflict'), host);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'some other conflict',
    });
  });

  it('falls back to a generic code for NotFoundException', () => {
    filter.catch(new NotFoundException('not found'), host);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, code: 'NOT_FOUND' }),
    );
  });

  it('falls back to a generic code for BadRequestException', () => {
    filter.catch(new BadRequestException('bad input'), host);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, code: 'BAD_REQUEST' }),
    );
  });

  it('never leaks the raw exception message for a genuinely unhandled (non-Http) error', () => {
    filter.catch(new Error('leaked internal detail: db password is X'), host);
    expect(jsonSpy).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });

  it('uses UNKNOWN_ERROR for an HTTP status with no registered default (e.g. 402)', () => {
    filter.catch(new HttpException('payment required', 402), host);
    expect(jsonSpy).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 402, code: 'UNKNOWN_ERROR' }),
    );
  });

  it('does not touch non-HTTP contexts (WebSocket gateways handle their own errors)', () => {
    const wsHost = { getType: () => 'ws' } as unknown as ArgumentsHost;
    expect(() => filter.catch(new Error('ws error'), wsHost)).toThrow('ws error');
  });
});
