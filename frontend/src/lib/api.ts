import axios from 'axios';

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;
