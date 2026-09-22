import * as semver from 'semver';

// Mirrors backend/src/common/agent-version.ts — same semver-based
// comparison, so the dashboard's "update available" badge and the
// server's downgrade guard can never disagree about what "newer" means.
// The frontend is a presentation layer only: it decides whether to SHOW
// the badge, but the backend independently re-validates and enforces the
// non-downgrade invariant on the actual update request.

export function isValidAgentVersion(v: string | null | undefined): v is string {
  return !!v && semver.valid(v) !== null;
}

export function isAgentUpdateAvailable(
  installed: string | null | undefined,
  latestStable: string | null | undefined,
): boolean {
  if (!isValidAgentVersion(installed) || !isValidAgentVersion(latestStable)) return false;
  return semver.gt(latestStable, installed);
}
