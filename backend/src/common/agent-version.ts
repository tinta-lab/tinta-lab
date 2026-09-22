import * as semver from 'semver';

// Single source of truth for "is this Agent version newer/older than that
// one" — used by the dashboard's update badge, the update endpoint's
// downgrade guard, and (mirrored) by the Agent's own self-update guard.
// Agent versions are already valid semver ("2026.9.2", "2026.9.2-beta.2"),
// so this wraps the `semver` package rather than comparing strings —
// plain `!==`/`<` on strings breaks on both prerelease tags and two-digit
// components ("2026.9.10" sorts before "2026.9.2" lexicographically).

export function isValidAgentVersion(v: string | null | undefined): v is string {
  return !!v && semver.valid(v) !== null;
}

// 1 if a>b, 0 if equal, -1 if a<b. Callers must validate both with
// isValidAgentVersion() first — throws on a malformed input otherwise.
export function compareAgentVersions(a: string, b: string): number {
  return semver.compare(a, b);
}

export function isAgentUpdateAvailable(
  installed: string,
  latestStable: string,
): boolean {
  return semver.gt(latestStable, installed);
}

export function isAgentDowngrade(installed: string, target: string): boolean {
  return semver.lt(target, installed);
}
