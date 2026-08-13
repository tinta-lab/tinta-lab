import type { CookieOptions } from 'express';

// Single source of truth for the auth cookie's name/attributes — shared by
// the login handler (auth.controller.ts) and the sliding-session renewal
// interceptor (sliding-session.interceptor.ts). Used to live duplicated in
// just the controller; kept here now so the two can never drift out of sync
// with each other (they did drift once, silently, before this existed).
export const AUTH_COOKIE = 'access_token';

export const AUTH_COOKIE_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export function authCookieOptions(cookieDomain: string): CookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    domain: cookieDomain,
    path: '/',
  };
}
