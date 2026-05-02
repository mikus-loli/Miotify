import { useState, useEffect } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';
import MobileMenu from './MobileMenu';

const navItems = [
  { to: '/dashboard', label: '仪表盘', icon: 'dashboard' },
  { to: '/messages', label: '消息', icon: 'message' },
  { to: '/applications', label: '应用', icon: 'app' },
  { to: '/users', label: '用户', icon: 'users' },
  { to: '/plugins', label: '插件', icon: 'plugin' },
  { to: '/logs', label: '日志', icon: 'log' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <main style={{
          flex: 1,
          minHeight: '100vh',
          paddingBottom: 80,
        }}>
          <div style={{
            maxWidth: '100%',
            margin: '0 auto',
            padding: '24px 16px 32px',
          }}>
            <Outlet />
          </div>
        </main>
        <MobileMenu />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{
        width: 'var(--sidebar-width)',
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        transition: 'background-color 0.4s ease, border-color 0.4s ease',
      }}>
        <div style={{
          padding: '24px 20px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
          }}>
            <Icon name="logo" size={22} color="#ffffff" />
          </div>
          <span className="brand-text">Miotify</span>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--radius)',
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                transition: 'all 0.2s ease',
                textDecoration: 'none',
              })}
            >
              <Icon name={item.icon} size={18} color={undefined} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--color-border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px',
            background: 'var(--color-surface-secondary)',
            borderRadius: 'var(--radius)',
            marginBottom: 12,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--gradient-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
            }}>
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'var(--color-text)',
              }}>
                {user?.name}
              </div>
              <div style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
              }}>
                {user?.admin ? '管理员' : '用户'}
              </div>
            </div>
            <ThemeToggle />
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center', gap: 8 }}
          >
            <Icon name="logout" size={14} />
            退出登录
          </button>
        </div>
      </aside>

      <main style={{
        flex: 1,
        marginLeft: 'var(--sidebar-width)',
        minHeight: '100vh',
      }}>
        <div style={{
          maxWidth: 'var(--content-max-width)',
          margin: '0 auto',
          padding: '40px 32px 64px',
        }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
