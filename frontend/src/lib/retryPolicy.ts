// Single shared retry policy (2026-09-22 error contract, Phase 1) — every
// component defers to this instead of inventing its own. Before this,
// HAWebSocketClient (Agent) hardcoded a flat 5s reconnect, cloudflared-tunnel.ts
// did exponential backoff capped at 60s, and the Install page's 429 handling
// read Retry-After correctly but only there — three different policies for
// the same error classes, and a new call site had no default to inherit.
//
// GET/HEAD/OPTIONS are always safe to auto-retry on 5xx/network — they
// can't have side effects. POST/PATCH/DELETE are deliberately NOT
// auto-retried on 5xx/network: a 5xx can happen after the request already
// executed server-side, so blindly retrying risks a duplicate side effect
// (e.g. a second ticket created, a second template applied). Those call
// sites should offer their own manual retry action instead — the Install
// page's retryLoad() already does exactly this for a GET, and the same
// "let the user choose to retry" pattern is the right one for mutations.
//
// 429 is the one status that's always safe to auto-retry regardless of
// method: NestJS's ThrottlerGuard rejects the request before the handler
// runs (confirmed against install.controller.ts's @Throttle behavior), so
// nothing executed yet — there's nothing to duplicate.
const SAFE_METHODS = new Set(['get', 'head', 'options']);
const MAX_ATTEMPTS = 3;
const MAX_DELAY_MS = 60_000;
const BASE_DELAY_MS = 1_000;

export interface RetryDecision {
  retry: boolean;
  delayMs: number;
}

export function classifyRetry(
  method: string | undefined,
  status: number | undefined,
  attempt: number,
  retryAfterSec?: number,
): RetryDecision {
  if (attempt >= MAX_ATTEMPTS) return { retry: false, delayMs: 0 };

  if (status === 429) {
    return {
      retry: true,
      delayMs: retryAfterSec && Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : backoff(attempt),
    };
  }

  // 401 (re-auth, not a retry), 403/404/410 (terminal), 409 (conflict —
  // context-dependent, never safe to assume retryable) all fall through to
  // "don't retry" below, same as any 4xx not explicitly handled above.
  const isSafeMethod = !!method && SAFE_METHODS.has(method.toLowerCase());
  const isServerOrNetworkError = status === undefined || status >= 500;
  if (isSafeMethod && isServerOrNetworkError) {
    return { retry: true, delayMs: backoff(attempt) };
  }

  return { retry: false, delayMs: 0 };
}

// Exponential backoff capped at 60s, with jitter (50-100% of the capped
// value) so many clients recovering from the same outage don't all retry
// in lockstep — matches cloudflared-tunnel.ts's existing, already-proven
// cap; this is that same policy, shared, not reinvented per component.
function backoff(attempt: number): number {
  const raw = BASE_DELAY_MS * 2 ** attempt;
  const capped = Math.min(raw, MAX_DELAY_MS);
  return Math.round(capped * (0.5 + Math.random() * 0.5));
}
