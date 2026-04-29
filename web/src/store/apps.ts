import { create } from 'zustand';
import { api } from '@/api/client';
import type { Application, CreateAppRequest, UpdateAppRequest } from '@/types';
import { useAuthStore } from './auth';

interface AppState {
  apps: Application[];
  loading: boolean;
  error: string | null;
  fetchApps: () => Promise<void>;
  createApp: (data: CreateAppRequest) => Promise<Application | null>;
  updateApp: (id: number, data: UpdateAppRequest) => Promise<void>;
  deleteApp: (id: number) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  apps: [],
  loading: false,
  error: null,

  fetchApps: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    set({ loading: true, error: null });
    try {
      const apps = await api.listApps(token);
      set({ apps, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createApp: async (data: CreateAppRequest) => {
    const token = useAuthStore.getState().token;
    if (!token) return null;
    try {
      const app = await api.createApp(data, token);
      set({ apps: [...get().apps, app] });
      return app;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  updateApp: async (id: number, data: UpdateAppRequest) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      const updated = await api.updateApp(id, data, token);
      set({ apps: get().apps.map((a) => (a.id === id ? updated : a)) });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteApp: async (id: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      await api.deleteApp(id, token);
      set({ apps: get().apps.filter((a) => a.id !== id) });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
