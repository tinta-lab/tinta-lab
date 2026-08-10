import { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defense-in-depth against CSRF, on top of the cookie's SameSite=Lax.
//
// Why this exists: the JWT moved from a JS-readable Authorization header
// into an httpOnly cookie the browser attaches automatically. SameSite=Lax
// already blocks cross-site POST/PATCH/DELETE from carrying the cookie in
// virtually all current browsers, but it's one browser-implementation detail
// to rely on alone for endpoints that can revoke a client's support access,
// delete a user, or push a raw command to a client's Home Assistant. This
// checks that mutating, cookie-authenticated requests actually originated
// from the dashboard's own origin.
//
// Deliberately scoped to cookie-authenticated requests only: Bearer-token
// callers (provision-client.sh, curl, Swagger "try it") never send an Origin
// header and are not vulnerable to CSRF in the first place — a foreign page
// cannot read a value it was never given to attach as a header.
export function csrfOriginGuard(allowedOrigin: string | undefined) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) return next();

    const hasBearer = !!req.headers.authorization?.startsWith('Bearer ');
    const hasCookieToken = !!(req as any).cookies?.access_token;
    if (hasBearer || !hasCookieToken) return next();

    if (!allowedOrigin) return next(); // misconfigured env — don't hard-fail every request

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    const source = origin ?? referer;

    if (!source || !source.startsWith(allowedOrigin)) {
      res.status(403).json({
        statusCode: 403,
        message: 'Cross-origin request rejected',
      });
      return;
    }
    next();
  };
}
