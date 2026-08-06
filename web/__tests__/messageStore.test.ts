import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMessageStore } from '@/store/messages';
import { useAuthStore } from '@/store/auth';

// mock WebSocket 管理器：捕获 store 真实注册的 handler，
// 测试直接触发该 handler，验证 store 订阅逻辑（不再复制实现）
const wsMock = vi.hoisted<{
  capturedHandler: ((msg: { id: number; appid: number }) => void) | null;
  unsub: (() => void) | null;
}>(() => ({
  capturedHandler: null,
  unsub: null,
}));

vi.mock('@/api/websocket', () => ({
  wsManager: {
    onMessage: vi.fn((handler: (msg: { id: number; appid: number }) => void) => {
      wsMock.capturedHandler = handler;
      wsMock.unsub = () => { wsMock.capturedHandler = null; };
      return wsMock.unsub;
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: false,
  },
}));

function makeMsg(id: number, appid = 1) {
  return { id, appid, message: `m${id}`, title: `t${id}`, priority: 0, created_at: '2026-01-01' };
}

describe('useMessageStore', () => {
  beforeEach(() => {
    useMessageStore.setState({
      messages: [],
      loading: false,
      error: null,
      filterAppId: null,
    });
    useAuthStore.setState({ token: null });
    wsMock.capturedHandler = null;
    wsMock.unsub = null;
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
    useMessageStore.setState({ messages: [makeMsg(1)] });
    const state = useMessageStore.getState();
    await state.deleteMessage(1);
    expect(useMessageStore.getState().messages).toHaveLength(1);
  });

  it('should not fetch messages without token', async () => {
    const state = useMessageStore.getState();
    await state.fetchMessages();
    expect(useMessageStore.getState().messages).toEqual([]);
  });

  it('subscribe: 收到实时消息插入列表头部', () => {
    const state = useMessageStore.getState();
    const unsub = state.subscribe();
    expect(wsMock.capturedHandler).toBeTruthy();

    wsMock.capturedHandler!(makeMsg(2));
    const messages = useMessageStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(2);

    unsub();
  });

  it('subscribe: 同 id 消息不重复插入', () => {
    useMessageStore.setState({ messages: [makeMsg(1)] });
    const state = useMessageStore.getState();
    const unsub = state.subscribe();

    wsMock.capturedHandler!(makeMsg(1));
    expect(useMessageStore.getState().messages).toHaveLength(1);

    unsub();
  });

  it('subscribe: 筛选状态下忽略其他应用的消息', () => {
    useMessageStore.setState({ filterAppId: 1 });
    const state = useMessageStore.getState();
    const unsub = state.subscribe();

    wsMock.capturedHandler!(makeMsg(2, 99)); // 其他应用
    expect(useMessageStore.getState().messages).toHaveLength(0);

    wsMock.capturedHandler!(makeMsg(3, 1)); // 当前筛选应用
    expect(useMessageStore.getState().messages).toHaveLength(1);
    expect(useMessageStore.getState().messages[0].id).toBe(3);

    unsub();
  });

  it('subscribe: 列表长度限制在 200 条', () => {
    const many = Array.from({ length: 200 }, (_, i) => makeMsg(i + 1));
    useMessageStore.setState({ messages: many });
    const state = useMessageStore.getState();
    const unsub = state.subscribe();

    wsMock.capturedHandler!(makeMsg(999));
    expect(useMessageStore.getState().messages).toHaveLength(200);
    expect(useMessageStore.getState().messages[0].id).toBe(999);

    unsub();
  });
});
