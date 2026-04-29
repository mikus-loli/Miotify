import { describe, it, expect, beforeEach } from 'vitest';
import { useMessageStore } from '@/store/messages';
import { useAuthStore } from '@/store/auth';

describe('useMessageStore', () => {
  beforeEach(() => {
    useMessageStore.setState({
      messages: [],
      loading: false,
      error: null,
      filterAppId: null,
    });
    useAuthStore.setState({ token: null });
  });

  it('should have correct initial state', () => {
    const state = useMessageStore.getState();
    expect(state.messages).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.filterAppId).toBeNull();
  });

  it('should set filter app id', () => {
    const state = useMessageStore.getState();
    state.setFilterAppId(5);
    expect(useMessageStore.getState().filterAppId).toBe(5);

    state.setFilterAppId(null);
    expect(useMessageStore.getState().filterAppId).toBeNull();
  });

  it('should not delete message from local state without token', async () => {
    const mockMessage = {
      id: 1,
      appid: 1,
      message: 'Hello',
      title: 'Test',
      priority: 0,
      created_at: '2026-01-01',
    };
    useMessageStore.setState({ messages: [mockMessage] });
    const state = useMessageStore.getState();
    await state.deleteMessage(1);
    expect(useMessageStore.getState().messages).toHaveLength(1);
  });

  it('should not fetch messages without token', async () => {
    const state = useMessageStore.getState();
    await state.fetchMessages();
    expect(useMessageStore.getState().messages).toEqual([]);
  });

  it('should subscribe and receive messages', () => {
    const mockMessage = {
      id: 2,
      appid: 1,
      message: 'New message',
      title: 'Hello',
      priority: 1,
      created_at: '2026-01-01',
    };
    useMessageStore.setState({ messages: [] });
    const state = useMessageStore.getState();
    const unsub = state.subscribe();

    const handler = (msg: typeof mockMessage) => {
      const current = useMessageStore.getState().messages;
      if (!current.some((m) => m.id === msg.id)) {
        useMessageStore.setState({ messages: [msg, ...current] });
      }
    };
    handler(mockMessage);

    expect(useMessageStore.getState().messages).toHaveLength(1);
    expect(useMessageStore.getState().messages[0].id).toBe(2);

    unsub();
  });

  it('should not add duplicate messages', () => {
    const mockMessage = {
      id: 1,
      appid: 1,
      message: 'Hello',
      title: 'Test',
      priority: 0,
      created_at: '2026-01-01',
    };
    useMessageStore.setState({ messages: [mockMessage] });

    const handler = (msg: typeof mockMessage) => {
      const current = useMessageStore.getState().messages;
      if (!current.some((m) => m.id === msg.id)) {
        useMessageStore.setState({ messages: [msg, ...current] });
      }
    };
    handler(mockMessage);

    expect(useMessageStore.getState().messages).toHaveLength(1);
  });
});
