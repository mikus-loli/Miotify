import { create } from 'zustand';
import { api } from '@/api/client';
import { wsManager } from '@/api/websocket';
import type { Message } from '@/types';
import { useAuthStore } from './auth';

interface MessageState {
  messages: Message[];
  loading: boolean;
  error: string | null;
  filterAppId: number | null;
  fetchMessages: (appid?: number) => Promise<void>;
  deleteMessage: (id: number) => Promise<void>;
  setFilterAppId: (appid: number | null) => void;
  subscribe: () => () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  loading: false,
  error: null,
  filterAppId: null,

  fetchMessages: async (appid?: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    set({ loading: true, error: null });
    try {
      const params: { limit?: number; appid?: number } = { limit: 100 };
      if (appid) params.appid = appid;
      const res = await api.getMessages(token, params);
      set({ messages: res.messages, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  deleteMessage: async (id: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      await api.deleteMessage(id, token);
      set({ messages: get().messages.filter((m) => m.id !== id) });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setFilterAppId: (appid: number | null) => {
    set({ filterAppId: appid });
  },

  subscribe: () => {
    const handler = (msg: Message) => {
      const current = get().messages;
      if (current.some((m) => m.id === msg.id)) return;
      set({ messages: [msg, ...current] });
    };
    wsManager.onMessage(handler);
    return () => wsManager.onMessage(() => {});
  },
}));
