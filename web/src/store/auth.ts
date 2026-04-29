import { create } from 'zustand';
import { api } from '@/api/client';
import { wsManager } from '@/api/websocket';
import type { LoginRequest, LoginResponse } from '@/types';

interface AuthState {
  token: string | null;
  user: LoginResponse | null;
  loading: boolean;
  error: string | null;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  loading: false,
  error: null,

  login: async (data: LoginRequest) => {
    set({ loading: true, error: null });
    try {
      const res = await api.login(data);
      localStorage.setItem('miotify_token', res.token);
      localStorage.setItem('miotify_user', JSON.stringify(res));
      wsManager.connect(res.token);
      set({ token: res.token, user: res, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('miotify_token');
    localStorage.removeItem('miotify_user');
    wsManager.disconnect();
    set({ token: null, user: null, error: null });
  },

  clearError: () => set({ error: null }),

  init: () => {
    const token = localStorage.getItem('miotify_token');
    const userStr = localStorage.getItem('miotify_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as LoginResponse;
        wsManager.connect(token);
        set({ token, user });
      } catch {
        localStorage.removeItem('miotify_token');
        localStorage.removeItem('miotify_user');
      }
    }
  },
}));
