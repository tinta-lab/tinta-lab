import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { AUTH_COOKIE, AUTH_COOKIE_MAX_AGE_MS, authCookieOptions } from './auth-cookie.constants';

// Cookie sessions hard-expired 15 minutes after login with nothing to renew
// them — dashboards had no session-expiry warning, so a staff member merely
// browsing (no REST calls, e.g. reading an already-loaded page) for 15+
// minutes would silently lose their session. The visible symptom that
// surfaced this: the `/servers` presence WebSocket (see PresenceBeacon) has
// no way to re-authenticate once the cookie expires, so it fails to
// reconnect on the next network blip/tab-sleep/navigation — with no REST
// 401 involved, the frontend's global logout-redirect never fires either,
// so support/sales staff showed as offline in "Команда" while still
// actively at their desk, sometimes for the rest of the session.
//
// Fix: every authenticated cookie-based request re-issues the cookie with a
// fresh token + a fresh 15-minute window — a sliding session. As long as the
// user keeps actively using the app (which is exactly when their WS needs to
// stay reconnectable), the cookie never reaches its expiry. Genuinely idle
// for 15+ minutes still logs them out, which is the intended behavior.
//
// Deliberately scoped to cookie-authenticated requests only — Bearer-token
// callers (provision-client.sh, curl, Swagger) never had a cookie to slide
// and shouldn't have one silently created for them.
@Injectable()
export class SlidingSessionInterceptor implements NestInterceptor {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const hadCookie = Boolean(req.cookies?.[AUTH_COOKIE]);

    return next.handle().pipe(
      tap(() => {
        if (!hadCookie) return;
        const user = (req as any).user as
          | { id: string; email: string; role: string }
          | undefined;
        if (!user) return; // request wasn't actually authenticated (e.g. hit a public route)

        const token = this.jwtService.sign({
          sub: user.id,
          email: user.email,
          role: user.role,
        });
        res.cookie(AUTH_COOKIE, token, {
          ...authCookieOptions(this.config.get('COOKIE_DOMAIN', '.tinta-lab.de')),
          maxAge: AUTH_COOKIE_MAX_AGE_MS,
        });
      }),
    );
  }
}
