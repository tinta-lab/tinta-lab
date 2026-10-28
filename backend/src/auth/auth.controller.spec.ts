import { ServiceUnavailableException } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { AuthController } from './auth.controller';
import { SlidingSessionInterceptor } from './sliding-session.interceptor';
import { AUTH_COOKIE } from './auth-cookie.constants';

// Logout used to answer with clearCookie AND, right after it, a fresh valid
// cookie from the sliding session — the browser stayed signed in. Now it
// revokes the session, clears the cookie, and nothing re-issues one; if the
// revocation can't be recorded it says so (503) instead of pretending.
describe('AuthController.logout', () => {
  const user = {
    id: 'user-1',
    email: 'a@b.c',
    role: 'admin',
    sid: 'sid-1',
    iat: 1,
    exp: 901,
  };

  async function logoutThroughInterceptor(authService: { logout: jest.Mock }) {
    const controller = new AuthController(
      authService as any,
      {} as any,
      {} as any,
    );
    const req: any = { cookies: { [AUTH_COOKIE]: 'tok' }, user };
    const res = { cookie: jest.fn(), clearCookie: jest.fn() };
    const interceptor = new SlidingSessionInterceptor(
      { sign: jest.fn().mockReturnValue('fresh') } as any,
      { get: jest.fn() } as any,
    );
    const ctx: any = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    };
    let error: unknown;
    try {
      await controller.logout(req, res as any);
      // the interceptor's renewal runs after a successful handler
      await lastValueFrom(
        interceptor.intercept(ctx, { handle: () => of(undefined) }),
      );
    } catch (err) {
      error = err;
    }
    return { res, error };
  }

  it('revokes the session, clears the cookie and does not re-issue one', async () => {
    const authService = { logout: jest.fn().mockResolvedValue(undefined) };
    const { res, error } = await logoutThroughInterceptor(authService);
    expect(error).toBeUndefined();
    expect(authService.logout).toHaveBeenCalledWith(user);
    expect(res.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE,
      expect.any(Object),
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('still clears the cookie but reports 503 when the revocation could not be recorded', async () => {
    const authService = {
      logout: jest
        .fn()
        .mockRejectedValue(
          new ServiceUnavailableException('Logout could not be completed'),
        ),
    };
    const { res, error } = await logoutThroughInterceptor(authService);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(res.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE,
      expect.any(Object),
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
