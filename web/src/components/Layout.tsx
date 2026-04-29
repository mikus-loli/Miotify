import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/messages', label: '消息', icon: '📨' },
    { to: '/applications', label: '应用', icon: '📱' },
    ...(user?.admin ? [{ to: '/users', label: '用户', icon: '👥' }] : []),
    ...(user?.admin ? [{ to: '/plugins', label: '插件', icon: '🔌' }] : []),
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <button
        className="btn-ghost btn-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none',
          position: 'fixed',
          top: 12,
          left: 12,
          zIndex: 1001,
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          padding: '6px 10px',
          fontSize: 18,
        }}
        aria-label="Toggle menu"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      <aside
        style={{
          width: 'var(--sidebar-width)',
          minWidth: 'var(--sidebar-width)',
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          position: mobileOpen ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 1000,
          transform: mobileOpen ? 'translateX(0)' : undefined,
        }}
        className="sidebar"
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 className="brand-text">
            Miotify
          </h2>
          <ThemeToggle />
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                borderRight: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                transition: 'all var(--transition)',
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
              })}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--color-border)',
        }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
            {user?.name} {user?.admin && <span className="badge badge-primary">管理员</span>}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            style={{ width: '100%' }}
          >
            退出登录
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--color-overlay)',
            zIndex: 999,
          }}
        />
      )}

      <main style={{
        flex: 1,
        padding: 24,
        overflowY: 'auto',
        maxWidth: '100%',
      }}>
        <Outlet />
      </main>
    </div>
  );
}
