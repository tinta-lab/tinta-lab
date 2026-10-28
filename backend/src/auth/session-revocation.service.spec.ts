import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AUTH_CHECK_TIMEOUT_MS,
  SessionRevocationService,
} from './session-revocation.service';

// Session revocation replaced a Redis blacklist that failed OPEN (a revoked
// token was accepted whenever Redis was unreachable). These pin the
// fail-closed contract: every way the check can't be made is a 503, every
// revoked/stale session is a 401, and logout never claims success it didn't
// record.
describe('SessionRevocationService', () => {
  const NOW = new Date('2026-10-28T18:00:00Z').getTime();
  const nowSec = Math.floor(NOW / 1000);
  const payload = {
    sub: 'user-1',
    sid: 'sid-1',
    iat: nowSec - 60,
    exp: nowSec + 840,
  };

  function setup(
    opts: {
      meta?: unknown;
      metaError?: Error;
      revoked?: boolean;
      existsError?: Error;
      insertError?: Error;
      deleteError?: Error;
      hang?: boolean;
    } = {},
  ) {
    const execute = opts.insertError
      ? jest.fn().mockRejectedValue(opts.insertError)
      : jest.fn().mockResolvedValue({});
    const orIgnore = jest.fn().mockReturnValue({ execute });
    const values = jest.fn().mockReturnValue({ orIgnore });
    const insert = jest.fn().mockReturnValue({ values });
    const never = new Promise(() => undefined);
    const repo = {
      exists: opts.hang
        ? jest.fn().mockReturnValue(never)
        : opts.existsError
          ? jest.fn().mockRejectedValue(opts.existsError)
          : jest.fn().mockResolvedValue(opts.revoked ?? false),
      createQueryBuilder: jest.fn().mockReturnValue({ insert }),
      delete: opts.deleteError
        ? jest.fn().mockRejectedValue(opts.deleteError)
        : jest.fn().mockResolvedValue({}),
    };
    const users = {
      getAuthMeta: opts.metaError
        ? jest.fn().mockRejectedValue(opts.metaError)
        : jest
            .fn()
            .mockResolvedValue(
              'meta' in opts
                ? opts.meta
                : { isActive: true, passwordChangedAt: null },
            ),
    };
    const service = new SessionRevocationService(repo as any, users as any);
    return { service, repo, users, values, orIgnore, execute };
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('assertSessionValid', () => {
    it('accepts an active user with a non-revoked session', async () => {
      const { service, repo } = setup();
      await expect(
        service.assertSessionValid(payload),
      ).resolves.toBeUndefined();
      expect(repo.exists).toHaveBeenCalledWith({
        where: { sessionId: 'sid-1' },
      });
    });

    it('rejects a token without a session id (pre-session tokens, non-session JWTs)', async () => {
      const { service, users } = setup();
      await expect(
        service.assertSessionValid({ sub: 'user-1', iat: payload.iat }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.getAuthMeta).not.toHaveBeenCalled();
    });

    it('rejects a revoked session', async () => {
      const { service } = setup({ revoked: true });
      await expect(service.assertSessionValid(payload)).rejects.toThrow(
        'Session has been revoked',
      );
    });

    it('rejects a deactivated user', async () => {
      const { service } = setup({
        meta: { isActive: false, passwordChangedAt: null },
      });
      await expect(service.assertSessionValid(payload)).rejects.toThrow(
        'Account is not active',
      );
    });

    it('rejects a deleted user', async () => {
      const { service } = setup({ meta: null });
      await expect(service.assertSessionValid(payload)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token issued before the last password change', async () => {
      const { service } = setup({
        meta: {
          isActive: true,
          passwordChangedAt: new Date((payload.iat + 1) * 1000),
        },
      });
      await expect(service.assertSessionValid(payload)).rejects.toThrow(
        'Token invalidated by password change',
      );
    });

    it('accepts a token issued in the same second as the password change (the re-issued one)', async () => {
      const { service } = setup({
        meta: {
          isActive: true,
          passwordChangedAt: new Date(payload.iat * 1000 + 500),
        },
      });
      await expect(
        service.assertSessionValid(payload),
      ).resolves.toBeUndefined();
    });

    it('fails closed (503) when the user lookup fails', async () => {
      const { service } = setup({ metaError: new Error('connection refused') });
      await expect(service.assertSessionValid(payload)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('fails closed (503) when the revocation lookup fails', async () => {
      const { service } = setup({
        existsError: new Error('relation "revoked_sessions" does not exist'),
      });
      await expect(service.assertSessionValid(payload)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('fails closed (503) instead of hanging when the database does not answer', async () => {
      const { service } = setup({ hang: true });
      const result = service.assertSessionValid(payload);
      const assertion = expect(result).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await jest.advanceTimersByTimeAsync(AUTH_CHECK_TIMEOUT_MS + 1);
      await assertion;
    });
  });

  describe('revoke', () => {
    it('records the session until its newest possible token has expired (+ margin)', async () => {
      const { service, values, orIgnore, execute } = setup();
      await service.revoke(payload);

      const ttlMs = (payload.exp - payload.iat) * 1000;
      expect(values).toHaveBeenCalledWith({
        sessionId: 'sid-1',
        userId: 'user-1',
        revokedAt: new Date(NOW),
        expiresAt: new Date(NOW + ttlMs + 60_000),
      });
      expect(orIgnore).toHaveBeenCalled(); // a second logout of the same session is fine
      expect(execute).toHaveBeenCalled();
    });

    it('throws 503 when the revocation cannot be recorded — logout must not report success', async () => {
      const { service } = setup({
        insertError: new Error('connection refused'),
      });
      await expect(service.revoke(payload)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('deletes expired rows, and a cleanup failure does not fail the logout', async () => {
      const { service, repo } = setup({ deleteError: new Error('boom') });
      await expect(service.revoke(payload)).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalled();
    });

    it('does nothing for a token without a session id', async () => {
      const { service, repo } = setup();
      await service.revoke({ sub: 'user-1' });
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
