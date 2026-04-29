import { useState } from 'react';
import { useThemeStore, type Theme } from '@/store/theme';

const themeOptions: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: '浅色', icon: '☀️' },
  { value: 'dark', label: '深色', icon: '🌙' },
  { value: 'system', label: '跟随系统', icon: '💻' },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = themeOptions.find((opt) => opt.value === theme) || themeOptions[2];

  const handleSelect = (value: Theme) => {
    setTheme(value);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="切换主题"
        title={currentOption.label}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 36,
          padding: '6px 10px',
        }}
      >
        <span style={{ fontSize: 16 }}>{currentOption.icon}</span>
      </button>

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 4px 16px var(--color-shadow)',
              zIndex: 999,
              minWidth: 140,
              overflow: 'hidden',
            }}
          >
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 14px',
                  background: theme === opt.value ? 'var(--color-primary-bg)' : 'transparent',
                  border: 'none',
                  color: theme === opt.value ? 'var(--color-primary)' : 'var(--color-text)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  transition: 'all var(--transition)',
                }}
                onMouseEnter={(e) => {
                  if (theme !== opt.value) {
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (theme !== opt.value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: 14 }}>{opt.icon}</span>
                <span>{opt.label}</span>
                {theme === opt.value && (
                  <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
