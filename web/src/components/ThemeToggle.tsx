import { useThemeStore } from '@/store/theme';

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  const handleToggle = () => {
    document.documentElement.classList.add('theme-transition');
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 350);
  };

  return (
    <button
      onClick={handleToggle}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-hover)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 15,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
      title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
