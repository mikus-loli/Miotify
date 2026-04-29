import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '@/store/theme';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({
      theme: 'system',
      resolvedTheme: 'dark',
    });
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
  });

  it('should have correct initial state', () => {
    const state = useThemeStore.getState();
    expect(state.theme).toBe('system');
    expect(state.resolvedTheme).toBe('dark');
  });

  it('should set theme to light', () => {
    const state = useThemeStore.getState();
    state.setTheme('light');
    const updated = useThemeStore.getState();
    expect(updated.theme).toBe('light');
    expect(updated.resolvedTheme).toBe('light');
    expect(localStorage.getItem('miotify_theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('should set theme to dark', () => {
    const state = useThemeStore.getState();
    state.setTheme('dark');
    const updated = useThemeStore.getState();
    expect(updated.theme).toBe('dark');
    expect(updated.resolvedTheme).toBe('dark');
    expect(localStorage.getItem('miotify_theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should persist theme preference', () => {
    localStorage.setItem('miotify_theme', 'light');
    const state = useThemeStore.getState();
    state.init();
    const updated = useThemeStore.getState();
    expect(updated.theme).toBe('light');
    expect(updated.resolvedTheme).toBe('light');
  });

  it('should default to system when no preference stored', () => {
    const state = useThemeStore.getState();
    state.init();
    const updated = useThemeStore.getState();
    expect(updated.theme).toBe('system');
  });

  it('should apply theme class to document', () => {
    const state = useThemeStore.getState();
    state.setTheme('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    state.setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
