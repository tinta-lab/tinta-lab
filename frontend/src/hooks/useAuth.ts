'use client';
import { create } from 'zustand';
import api from '@/lib/api';
import { User, AuthResponse } from '@/types';

interface AuthStore {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; phone: string; city?: string }) => Promise<void>;
  logout: () => Promise<void>;
  init: () => void;
}

export const useAuth = create<AuthStore>((set, get) => ({
  user: null,
  token: null,

  init: () => {
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('user');
    if (token && user) {
      set({ token, user: JSON.parse(user) });
    }
  },

  login: async (email, password) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    document.cookie = `access_token=${data.access_token}; path=/; max-age=900`;
    set({ user: data.user, token: data.access_token });
  },

  register: async (formData) => {
    const { data } = await api.post<AuthResponse>('/auth/register', formData);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    document.cookie = `access_token=${data.access_token}; path=/; max-age=900`;
    set({ user: data.user, token: data.access_token });
  },

  logout: async () => {
    const token = get().token;
    if (token) {
      try {
        await api.post('/auth/logout');
      } catch { /* ignore — server-side blacklist best-effort */ }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    document.cookie = 'access_token=; path=/; max-age=0';
    set({ user: null, token: null });
    window.location.href = '/auth/login';
  },
}));
