import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { classifyRetry } from './retryPolicy';

interface RetryableConfig extends InternalAxiosRequestConfig {
  __retryAttempt?: number;
}

const baseURL = process.env.NEXT_PUBLIC_API_URL;

if (!baseURL && typeof window !== 'undefined') {
  console.error(
    '[Tinta] NEXT_PUBLIC_API_URL is not set. ' +
    'Add NEXT_PUBLIC_API_URL=https://api.tinta-lab.de to frontend/.env.local',
  );
}

const api = axios.create({
  baseURL: baseURL ?? '',
  timeout: 15_000,
  // The auth token travels as an httpOnly cookie (set by the backend on
  // login) rather than a JS-readable Authorization header — the browser
  // attaches it automatically as long as this stays true.
  withCredentials: true,
});

// Shared retry policy (see lib/retryPolicy.ts) — applies to every request
// made through this instance, so no component needs its own reconnect/retry
// logic for the classes it covers (safe-method 5xx/network, and 429 on any
// method). A request that already retried MAX_ATTEMPTS times, or that isn't
// covered (a mutating POST/PATCH/DELETE hitting 5xx), falls through to the
// caller's own catch — exactly the existing per-page error handling.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return Promise.reject(error);
    }

    const config = error.config as RetryableConfig | undefined;
    if (config && isAxiosError(error)) {
      const attempt = config.__retryAttempt ?? 0;
      const status = error.response?.status;
      const retryAfterHeader = error.response?.headers?.['retry-after'];
      const retryAfterSec = retryAfterHeader ? parseInt(String(retryAfterHeader), 10) : undefined;
      const decision = classifyRetry(config.method, status, attempt, retryAfterSec);
      if (decision.retry) {
        config.__retryAttempt = attempt + 1;
        await new Promise((resolve) => setTimeout(resolve, decision.delayMs));
        return api(config);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
