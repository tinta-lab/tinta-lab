import { isAxiosError } from 'axios';
import type { TranslationKey } from '@/i18n/translations';

// Backend (2026-09-22 error contract, Phase 1 — see
// backend/src/common/api-error.ts) sends a stable `code` on every error
// response, not just a status + English `message`. This is the single
// place that maps a code to a translation key — never compare against
// `message` text at a call site (that's exactly the fragile coupling this
// replaces: the frontend used to match the literal string
// 'Email already exists', which a backend copy-edit could silently break).
//
// Not every code needs a specific entry — most of the generic per-status
// fallbacks (BAD_REQUEST, INTERNAL_ERROR, etc.) fall through to the
// existing generic `error` key, which is exactly correct: "something went
// wrong" is the honest thing to say when nothing more specific is known.
const API_ERROR_CODE_KEYS: Record<string, TranslationKey> = {
  CLIENT_EMAIL_EXISTS: 'err_email_taken',
  SUPPORT_SESSION_CLAIMED: 'support_session_claimed',
  AGENT_DOWNGRADE_REJECTED: 'hub_downgrade_rejected',
};

export function getApiErrorCode(err: unknown): string | undefined {
  if (isAxiosError(err)) {
    return (err.response?.data as { code?: string } | undefined)?.code;
  }
  return undefined;
}

// Returns a localized message for any error, falling back to the generic
// `error` key for a code this frontend has no specific mapping for (new
// backend codes, or one of the generic per-status ones) — never the
// backend's raw English `message`.
export function translateApiError(err: unknown, t: (k: TranslationKey) => string): string {
  const code = getApiErrorCode(err);
  const key = code ? API_ERROR_CODE_KEYS[code] : undefined;
  return t(key ?? 'error');
}
