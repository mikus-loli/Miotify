import { create } from 'zustand';
import { api } from '@/api/client';
import type { Plugin } from '@/types';
import { useAuthStore } from './auth';

interface PluginState {
  plugins: Plugin[];
  loading: boolean;
  error: string | null;
  fetchPlugins: () => Promise<void>;
  setPluginEnabled: (id: string, enabled: boolean) => Promise<void>;
  setPluginConfig: (id: string, config: Record<string, unknown>) => Promise<void>;
  setPluginPriority: (id: string, priority: number) => Promise<void>;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  loading: false,
  error: null,

  fetchPlugins: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    set({ loading: true, error: null });
    try {
      const plugins = await api.listPlugins(token);
      set({ plugins, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  setPluginEnabled: async (id: string, enabled: boolean) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      const updated = await api.setPluginEnabled(id, { enabled }, token);
      set({ plugins: get().plugins.map(p => p.id === id ? updated : p) });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setPluginConfig: async (id: string, config: Record<string, unknown>) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      const updated = await api.setPluginConfig(id, config, token);
      set({ plugins: get().plugins.map(p => p.id === id ? updated : p) });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setPluginPriority: async (id: string, priority: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      const updated = await api.setPluginPriority(id, { priority }, token);
      set({ plugins: get().plugins.map(p => p.id === id ? updated : p) });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
