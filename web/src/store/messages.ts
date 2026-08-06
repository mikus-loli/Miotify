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
      const { filterAppId, messages: current } = get();
      // 实时推送按当前筛选过滤（筛选状态下不混入其他应用的新消息）
      if (filterAppId !== null && msg.appid !== filterAppId) return;
      if (current.some((m) => m.id === msg.id)) return;
      // 限制列表长度，避免长时间运行 + 高频推送导致内存无限增长
      set({ messages: [msg, ...current].slice(0, MAX_LISTED_MESSAGES) });
    };
    // onMessage 返回取消订阅函数，避免组件卸载后覆盖其他订阅者的 handler
    return wsManager.onMessage(handler);
  },
}));

const MAX_LISTED_MESSAGES = 200;
