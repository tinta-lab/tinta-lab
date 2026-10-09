import { HttpException } from '@nestjs/common';

// Stable, machine-readable identity for an error — the thing a frontend or
// Agent switches on, never the English `message` (which is free to change
// wording without becoming a breaking change, unlike a `code`). Extend this
// union as real call sites need a specific code; anything not migrated yet
// still gets a generic per-status code from all-exceptions.filter.ts, so
// every response has *a* code from day one, not just the migrated ones.
export type ApiErrorCode =
  // Specific — assigned to real call sites during the 2026-09-22 error
  // contract migration (see MIGRATION_NOTES below for why these three
  // came first).
  | 'CLIENT_EMAIL_EXISTS'
  | 'SUPPORT_SESSION_CLAIMED'
  | 'AGENT_DOWNGRADE_REJECTED'
  // Generic — one per HTTP status class, used as the fallback for any
  // exception that doesn't (yet) carry a specific ApiError.
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GONE'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

// Thrown instead of a bare Nest HttpException (ConflictException, etc.)
// wherever the frontend or Agent needs to react to *which* error this is,
// not just display it. `message` stays English and log-only — it must
// never be the thing a UI renders (see all-exceptions.filter.ts's response
// shape, and frontend/src/lib/apiError.ts on the consuming side).
export class ApiError extends HttpException {
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message, status);
    this.code = code;
    this.details = details;
  }
}

// MIGRATION_NOTES: CLIENT_EMAIL_EXISTS, SUPPORT_SESSION_CLAIMED, and
// AGENT_DOWNGRADE_REJECTED were the first three migrated because each was
// already a known, verified problem this session: the frontend was
// string-matching on 'Email already exists' (fragile coupling — a backend
// copy-edit would silently break it), the support-session-claimed message
// embedded a real staff member's name directly in text shown to another
// staff member (an information-disclosure concern, not just an i18n one),
// and the downgrade-rejection message is exactly the guard the 2026.9.2
// downgrade-protection bugfix depends on staying reachable by code, not by
// parsing English prose. The full endpoint-by-endpoint migration is
// intentionally NOT done in one pass — see the review artifact's Phase 1
// scoping note: extend this list incrementally as each remaining raw
// ConflictException/BadRequestException is touched for another reason,
// rather than a single big-bang rewrite of every controller.
