import { of, lastValueFrom } from 'rxjs';
import {
  SlidingSessionInterceptor,
  markSessionEnded,
} from './sliding-session.interceptor';
import { AUTH_COOKIE } from './auth-cookie.constants';

// The interceptor used to re-issue a fresh token right after logout's
// clearCookie (the browser stayed signed in), and re-issued tokens carried
// no session id, so logout couldn't revoke them.
describe('SlidingSessionInterceptor', () => {
  const user = {
    id: 'user-1',
    email: 'a@b.c',
    role: 'admin',
    sid: 'sid-1',
    iat: 1,
    exp: 2,
  };

  function run(req: any) {
    const jwt = { sign: jest.fn().mockReturnValue('new-token') };
    const config = { get: jest.fn().mockReturnValue('.tinta-lab.de') };
    const res = { cookie: jest.fn() };
    const ctx: any = {
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    };
    const interceptor = new SlidingSessionInterceptor(
      jwt as any,
      config as any,
    );
    return lastValueFrom(
      interceptor.intercept(ctx, { handle: () => of('ok') }),
    ).then(() => ({
      jwt,
      res,
    }));
  }

  it('re-issues the cookie under the same session id', async () => {
    const { jwt, res } = await run({ cookies: { [AUTH_COOKIE]: 'old' }, user });
    expect(jwt.sign).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'a@b.c',
      role: 'admin',
      sid: 'sid-1',
    });
    expect(res.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE,
      'new-token',
      expect.any(Object),
    );
  });

  it('does not re-issue on a response that ended the session (logout)', async () => {
    const req: any = { cookies: { [AUTH_COOKIE]: 'old' }, user };
    markSessionEnded(req);
    const { jwt, res } = await run(req);
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('never mints a session-less token', async () => {
    const { sid: _sid, ...noSid } = user;
    const { jwt, res } = await run({
      cookies: { [AUTH_COOKIE]: 'old' },
      user: noSid,
    });
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('does nothing for Bearer (cookie-less) callers', async () => {
    const { jwt } = await run({ cookies: {}, user });
    expect(jwt.sign).not.toHaveBeenCalled();
  });
});
