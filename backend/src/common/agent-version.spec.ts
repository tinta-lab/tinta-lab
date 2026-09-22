import {
  isValidAgentVersion,
  compareAgentVersions,
  isAgentUpdateAvailable,
  isAgentDowngrade,
} from './agent-version';

describe('agent-version', () => {
  describe('isValidAgentVersion', () => {
    it('accepts plain CalVer-as-semver strings', () => {
      expect(isValidAgentVersion('2026.9.2')).toBe(true);
    });

    it('accepts prerelease (beta) versions', () => {
      expect(isValidAgentVersion('2026.9.2-beta.2')).toBe(true);
    });

    it('rejects malformed versions', () => {
      expect(isValidAgentVersion('not-a-version')).toBe(false);
      expect(isValidAgentVersion('2026.9')).toBe(false);
      expect(isValidAgentVersion('')).toBe(false);
    });

    it('rejects missing version metadata', () => {
      expect(isValidAgentVersion(null)).toBe(false);
      expect(isValidAgentVersion(undefined)).toBe(false);
    });
  });

  describe('compareAgentVersions — numeric, not lexicographic', () => {
    it('2026.9.10 is newer than 2026.9.2 (would be reversed by string comparison)', () => {
      expect(compareAgentVersions('2026.9.10', '2026.9.2')).toBe(1);
      expect('2026.9.10' < '2026.9.2').toBe(true); // the bug this guards against
    });
  });

  describe('isAgentUpdateAvailable', () => {
    it('2026.9.1 → 2026.9.2 is an update', () => {
      expect(isAgentUpdateAvailable('2026.9.1', '2026.9.2')).toBe(true);
    });

    it('2026.9.2 → 2026.9.2 is not an update (already up to date)', () => {
      expect(isAgentUpdateAvailable('2026.9.2', '2026.9.2')).toBe(false);
    });

    it('2026.9.2 → 2026.8.3 is not an update (would be a downgrade)', () => {
      expect(isAgentUpdateAvailable('2026.9.2', '2026.8.3')).toBe(false);
    });

    it('2026.10.0 → 2026.9.2 is not an update (installed is newer)', () => {
      expect(isAgentUpdateAvailable('2026.10.0', '2026.9.2')).toBe(false);
    });

    it('a stable release is not "newer" than its own beta', () => {
      // 2026.9.2-beta.2 is a prerelease OF 2026.9.2, so the stable release
      // is newer per semver prerelease ordering.
      expect(isAgentUpdateAvailable('2026.9.2-beta.2', '2026.9.2')).toBe(true);
      expect(isAgentUpdateAvailable('2026.9.2', '2026.9.2-beta.2')).toBe(false);
    });
  });

  describe('isAgentDowngrade', () => {
    it('flags 2026.9.2 → 2026.8.3 as a downgrade', () => {
      expect(isAgentDowngrade('2026.9.2', '2026.8.3')).toBe(true);
    });

    it('does not flag 2026.9.1 → 2026.9.2 as a downgrade', () => {
      expect(isAgentDowngrade('2026.9.1', '2026.9.2')).toBe(false);
    });

    it('does not flag equal versions as a downgrade', () => {
      expect(isAgentDowngrade('2026.9.2', '2026.9.2')).toBe(false);
    });

    it('throws on malformed input — callers must validate first', () => {
      expect(() => isAgentDowngrade('2026.9.2', 'not-a-version')).toThrow();
    });
  });
});
