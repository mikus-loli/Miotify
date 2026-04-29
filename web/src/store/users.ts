import { create } from 'zustand';
import { api } from '@/api/client';
import type { User, CreateUserRequest } from '@/types';
import { useAuthStore } from './auth';

interface UserState {
  users: User[];
  loading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  createUser: (data: CreateUserRequest) => Promise<boolean>;
  deleteUser: (id: number) => Promise<boolean>;
}

export const useUserStore = create<UserState>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  fetchUsers: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    set({ loading: true, error: null });
    try {
      const users = await api.listUsers(token);
      set({ users, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createUser: async (data: CreateUserRequest) => {
    const token = useAuthStore.getState().token;
    if (!token) return false;
    try {
      const user = await api.createUser(data, token);
      set({ users: [...get().users, user] });
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  deleteUser: async (id: number) => {
    const token = useAuthStore.getState().token;
    if (!token) return false;
    try {
      await api.deleteUser(id, token);
      set({ users: get().users.filter((u) => u.id !== id) });
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },
}));
