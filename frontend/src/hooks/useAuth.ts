'use client';
import { create } from 'zustand';
import { isAxiosError } from 'axios';
import api from '@/lib/api';
import { User, AuthResponse } from '@/types';

interface AuthStore {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
}

// The JWT itself lives only in the backend-set httpOnly `access_token`
// cookie now — the browser attaches it automatically (see lib/api.ts
// `withCredentials`), and no client-side JS ever touches its value. Only
// the non-sensitive `user` profile is kept here for UI state/role routing.
export const useAuth = create<AuthStore>((set, get) => ({
  user: null,

  init: () => {
    const user = localStorage.getItem('user');
    if (user) set({ user: JSON.parse(user) });
  },

  login: async (email, password) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('user', JSON.stringify(data.user));
    set({ user: data.user });
  },

  // The server revokes the whole session and clears the cookie. If it
  // couldn't record the revocation (503) or wasn't reachable, local sign-out
  // still happens, but the login page says the server didn't confirm it
  // instead of implying a clean logout. A 401 means the session was already
  // dead — nothing left to revoke.
  logout: async () => {
    let unconfirmed = false;
    if (get().user) {
      try {
        await api.post('/auth/logout');
      } catch (e) {
        unconfirmed = !(isAxiosError(e) && e.response?.status === 401);
      }
    }
    localStorage.removeItem('user');
    set({ user: null });
    window.location.href = unconfirmed ? '/auth/login?logout=unconfirmed' : '/auth/login';
  },
}));
