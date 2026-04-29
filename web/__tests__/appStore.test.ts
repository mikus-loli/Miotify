import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/apps';
import { useAuthStore } from '@/store/auth';

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      apps: [],
      loading: false,
      error: null,
    });
    useAuthStore.setState({ token: null });
  });

  it('should have correct initial state', () => {
    const state = useAppStore.getState();
    expect(state.apps).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should not fetch apps without token', async () => {
    const state = useAppStore.getState();
    await state.fetchApps();
    expect(useAppStore.getState().apps).toEqual([]);
  });

  it('should return null when creating app without token', async () => {
    const state = useAppStore.getState();
    const result = await state.createApp({ name: 'TestApp' });
    expect(result).toBeNull();
  });

  it('should not delete app from local state without token', async () => {
    const mockApp = {
      id: 1,
      token: 'test-token',
      name: 'TestApp',
      description: '',
      image: '',
      user_id: 1,
      created_at: '2026-01-01',
    };
    useAppStore.setState({ apps: [mockApp] });
    const state = useAppStore.getState();
    await state.deleteApp(1);
    expect(useAppStore.getState().apps).toHaveLength(1);
  });

  it('should manually update apps state', () => {
    const mockApp = {
      id: 1,
      token: 'test-token',
      name: 'TestApp',
      description: '',
      image: '',
      user_id: 1,
      created_at: '2026-01-01',
    };
    useAppStore.setState({ apps: [mockApp] });
    expect(useAppStore.getState().apps).toHaveLength(1);
    expect(useAppStore.getState().apps[0].name).toBe('TestApp');
  });
});
