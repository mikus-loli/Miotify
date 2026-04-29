import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null,
      user: null,
      loading: false,
      error: null,
    });
    localStorage.clear();
  });

  it('should have correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('should set error on login failure', async () => {
    const state = useAuthStore.getState();
    await state.login({ name: 'invalid', pass: 'invalid' });
    const updated = useAuthStore.getState();
    expect(updated.error).toBeTruthy();
    expect(updated.token).toBeNull();
  });

  it('should clear error', () => {
    useAuthStore.setState({ error: 'some error' });
    const state = useAuthStore.getState();
    state.clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('should logout and clear state', () => {
    useAuthStore.setState({
      token: 'test-token',
      user: { token: 'test-token', id: 1, name: 'admin', admin: true },
    });
    localStorage.setItem('miotify_token', 'test-token');
    localStorage.setItem('miotify_user', '{}');

    const state = useAuthStore.getState();
    state.logout();

    const updated = useAuthStore.getState();
    expect(updated.token).toBeNull();
    expect(updated.user).toBeNull();
    expect(localStorage.getItem('miotify_token')).toBeNull();
    expect(localStorage.getItem('miotify_user')).toBeNull();
  });

  it('should init from localStorage', () => {
    const userData = { token: 'stored-token', id: 1, name: 'admin', admin: true };
    localStorage.setItem('miotify_token', 'stored-token');
    localStorage.setItem('miotify_user', JSON.stringify(userData));

    const state = useAuthStore.getState();
    state.init();

    const updated = useAuthStore.getState();
    expect(updated.token).toBe('stored-token');
    expect(updated.user?.name).toBe('admin');
  });

  it('should handle corrupted localStorage data', () => {
    localStorage.setItem('miotify_token', 'token');
    localStorage.setItem('miotify_user', 'invalid-json');

    const state = useAuthStore.getState();
    state.init();

    const updated = useAuthStore.getState();
    expect(updated.token).toBeNull();
    expect(updated.user).toBeNull();
  });
});
