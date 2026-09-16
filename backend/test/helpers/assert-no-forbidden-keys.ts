// Security regression guard for HTTP response bodies. This project has had
// real leaks of exactly this shape reach production (raw AccessLog exposing
// `supportPassword` from POST /access/grant/:serverId; raw Server exposing
// Cloudflare tunnel secrets from staff ticket responses) — always because a
// handler returned an entity/relation instead of a view DTO. A field-name
// check on the actual JSON response is the only thing that catches this
// regardless of *how* the leak was introduced (new relation, new spread,
// forgotten `toXView()` call), so it must run against `response.body`, never
// against a DTO constructed directly in the test.
//
// Checks property NAMES only, recursively through objects and arrays — a
// forbidden key with a `null` or `undefined` value is still a violation,
// because the contract is "this field must never be present", not "must
// never have a truthy value".

function walk(
  value: unknown,
  forbidden: ReadonlySet<string>,
  path: string,
  violations: string[],
): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, forbidden, `${path}[${i}]`, violations));
    return;
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (forbidden.has(key)) {
      violations.push(currentPath);
    }
    walk(val, forbidden, currentPath, violations);
  }
}

/**
 * Asserts that none of `forbiddenKeys` appears as a property name anywhere
 * in `body` (recursing through nested objects and arrays). Throws with every
 * violating path on failure, e.g.:
 *
 *   Security contract violation: forbidden key(s) found in response:
 *     - response[0].server.tunnelToken
 *     - response.ticket.server.supportPassword
 */
export function assertNoForbiddenKeys(
  body: unknown,
  forbiddenKeys: readonly string[],
  rootPath = 'response',
): void {
  const violations: string[] = [];
  walk(body, new Set(forbiddenKeys), rootPath, violations);
  if (violations.length > 0) {
    const list = violations.map((p) => `  - ${p}`).join('\n');
    throw new Error(
      `Security contract violation: forbidden key(s) found in response:\n${list}`,
    );
  }
}

/** Single-key convenience wrapper — same recursive + path-reporting behavior. */
export function assertNoKey(body: unknown, key: string): void {
  assertNoForbiddenKeys(body, [key]);
}

// Cloudflare tunnel / infra plumbing — never leaves the server for ANY
// caller, staff included. Lives on the raw Server entity as plain columns
// with no `select: false`, so this is the exact set that toClientServerView
// / toSupportServerView exist to strip.
export const INFRA_SECRET_KEYS = [
  'tunnelToken',
  'tunnelId',
  'cfAccessAppId',
  'cfDnsRecordId',
  'localUrl',
] as const;

// Fields a CLIENT must never see: infra secrets, any credential
// (hashed login password or the plaintext supportPassword an AccessLog
// carries for SUPPORT's use), and staff-internal ticket-management fields.
export const CLIENT_FORBIDDEN_KEYS = [
  ...INFRA_SECRET_KEYS,
  'password',
  'supportPassword',
  'internalNotes',
  'assignedTo',
] as const;

// Fields SUPPORT/SALES must never see on the endpoints this profile is
// applied to (GET /tickets, GET /tickets/:id, GET /access/logs, GET
// /access/sessions/:id). `internalNotes`/`assignedTo` are deliberately
// NOT here — those are legitimate staff-facing ticket-management fields.
// `supportPassword` IS here because none of the above endpoints are the
// credential-delivery endpoint — that's the separate, deliberately
// privileged POST /access/connect/:serverId, which this profile is never
// applied to.
export const STAFF_FORBIDDEN_KEYS = [
  ...INFRA_SECRET_KEYS,
  'password',
  'supportPassword',
] as const;
