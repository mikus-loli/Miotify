import { useState, useEffect, useCallback, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import ThemeToggle from './ThemeToggle';
import Icon from './Icon';

type MenuMode = 'sidebar' | 'bottom';
type MenuLevel = 0 | 1 | 2 | 3;

interface MenuItem {
  id: string;
  to?: string;
  label: string;
  icon: string;
  children?: MenuItem[];
  action?: () => void;
}

const menuStructure: MenuItem[] = [
  {
    id: 'dashboard',
    to: '/dashboard',
    label: '仪表盘',
    icon: 'dashboard',
  },
  {
    id: 'messages',
    to: '/messages',
    label: '消息',
    icon: 'message',
  },
  {
    id: 'apps',
    label: '应用管理',
    icon: 'app',
    children: [
      { id: 'apps-list', to: '/applications', label: '应用列表', icon: 'app' },
      { id: 'apps-create', to: '/applications?create=1', label: '创建应用', icon: 'plus' },
    ],
  },
  {
    id: 'users',
    to: '/users',
    label: '用户管理',
    icon: 'users',
  },
  {
    id: 'plugins',
    to: '/plugins',
    label: '插件管理',
    icon: 'plugin',
  },
  {
    id: 'logs',
    to: '/logs',
    label: '系统日志',
    icon: 'log',
  },
];

const STORAGE_KEY = 'miotify_menu_state';

interface MenuState {
  mode: MenuMode;
  expandedItems: string[];
}

function loadMenuState(): MenuState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return { mode: 'sidebar', expandedItems: [] };
}

function saveMenuState(state: MenuState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export default function MobileMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<MenuState>(loadMenuState);
  const [currentLevel, setCurrentLevel] = useState<MenuLevel>(0);
  const [levelHistory, setLevelHistory] = useState<{ parent: MenuItem; items: MenuItem[] }[]>([]);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveMenuState(state);
  }, [state]);

  useEffect(() => {
    setIsOpen(false);
    setCurrentLevel(0);
    setLevelHistory([]);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLogout = useCallback(() => {
    setIsOpen(false);
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const toggleExpanded = useCallback((itemId: string) => {
    setState(prev => ({
      ...prev,
      expandedItems: prev.expandedItems.includes(itemId)
        ? prev.expandedItems.filter(id => id !== itemId)
        : [...prev.expandedItems, itemId],
    }));
  }, []);

  const navigateToLevel = useCallback((parent: MenuItem, items: MenuItem[]) => {
    setLevelHistory(prev => [...prev, { parent, items }]);
    setCurrentLevel(Math.min(currentLevel + 1, 3) as MenuLevel);
  }, [currentLevel]);

  const goBack = useCallback(() => {
    if (levelHistory.length > 0) {
      setLevelHistory(prev => prev.slice(0, -1));
      setCurrentLevel(Math.max(currentLevel - 1, 0) as MenuLevel);
    }
  }, [levelHistory, currentLevel]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isOpen) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (deltaY > Math.abs(deltaX)) return;
    if (state.mode === 'sidebar' && deltaX < -50) {
      setIsOpen(false);
    }
  }, [isOpen, state.mode]);

  const handleOverlayClick = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleMode = useCallback(() => {
    setState(prev => ({
      ...prev,
      mode: prev.mode === 'sidebar' ? 'bottom' : 'sidebar',
    }));
  }, []);

  const currentItems = levelHistory.length > 0
    ? levelHistory[levelHistory.length - 1].items
    : menuStructure;

  const renderMenuItem = (item: MenuItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = state.expandedItems.includes(item.id);
    const isActive = item.to === location.pathname;

    if (item.to) {
      return (
        <NavLink
          key={item.id}
          to={item.to}
          onClick={() => setIsOpen(false)}
          className="mobile-menu-item"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 'var(--radius)',
            fontSize: 15,
            fontWeight: isActive ? 600 : 500,
            color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
            background: isActive ? 'var(--color-primary-bg)' : 'transparent',
            textDecoration: 'none',
            minHeight: 48,
            transition: 'all 0.15s ease',
          }}
        >
          <Icon name={item.icon} size={20} color={isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)'} />
          <span style={{ flex: 1 }}>{item.label}</span>
          {hasChildren && depth === 0 && (
            <Icon
              name="chevronDown"
              size={16}
              color="var(--color-text-muted)"
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            />
          )}
        </NavLink>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => {
          if (hasChildren) {
            if (state.mode === 'bottom') {
              navigateToLevel(item, item.children!);
            } else {
              toggleExpanded(item.id);
            }
          } else if (item.action) {
            item.action();
            setIsOpen(false);
          }
        }}
        className="mobile-menu-item"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 'var(--radius)',
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--color-text)',
          background: 'transparent',
          width: '100%',
          border: 'none',
          cursor: 'pointer',
          minHeight: 48,
          transition: 'all 0.15s ease',
          textAlign: 'left' as const,
        }}
      >
        <Icon name={item.icon} size={20} color="var(--color-text-secondary)" />
        <span style={{ flex: 1 }}>{item.label}</span>
        {hasChildren && (
          <Icon name="chevronDown" size={16} color="var(--color-text-muted)" />
        )}
      </button>
    );
  };

  const renderExpandedChildren = (item: MenuItem) => {
    if (!item.children || item.children.length === 0) return null;
    const isExpanded = state.expandedItems.includes(item.id);
    if (!isExpanded) return null;

    return (
      <div
        className="mobile-menu-submenu"
        style={{
          marginLeft: 20,
          paddingLeft: 12,
          borderLeft: '2px solid var(--color-border)',
          marginTop: 4,
          animation: 'slideDown 0.2s ease forwards',
        }}
      >
        {item.children.map(child => renderMenuItem(child, 1))}
      </div>
    );
  };

  const menuContent = (
    <>
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)',
          }}>
            <Icon name="logo" size={22} color="#ffffff" />
          </div>
          <span className="brand-text" style={{ fontSize: 20 }}>Miotify</span>
        </div>
        <button
          onClick={toggleMode}
          style={{
            padding: 8,
            background: 'var(--color-surface-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 44,
            minHeight: 44,
          }}
          title={state.mode === 'sidebar' ? '切换到底部菜单' : '切换到侧边菜单'}
        >
          <Icon name={state.mode === 'sidebar' ? 'app' : 'menu'} size={18} color="var(--color-text-secondary)" />
        </button>
      </div>

      {currentLevel > 0 && levelHistory.length > 0 && (
        <button
          onClick={goBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'var(--color-surface-secondary)',
            border: 'none',
            borderBottom: '1px solid var(--color-border)',
            width: '100%',
            cursor: 'pointer',
            fontSize: 14,
            color: 'var(--color-text-secondary)',
            minHeight: 48,
          }}
        >
          <Icon name="chevronDown" size={16} color="var(--color-text-muted)" style={{ transform: 'rotate(90deg)' }} />
          返回 {levelHistory[levelHistory.length - 1].parent.label}
        </button>
      )}

      <nav style={{
        flex: 1,
        padding: '12px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {currentItems.map(item => (
          <div key={item.id} style={{ marginBottom: 4 }}>
            {renderMenuItem(item)}
            {state.mode === 'sidebar' && renderExpandedChildren(item)}
          </div>
        ))}
      </nav>

      <div style={{
        padding: '12px 16px 20px',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface-secondary)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          marginBottom: 12,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--gradient-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 16,
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
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {user?.admin ? '管理员' : '用户'}
            </div>
          </div>
          <ThemeToggle />
        </div>
        <button
          className="btn btn-ghost"
          onClick={handleLogout}
          style={{ width: '100%', justifyContent: 'center', gap: 8, minHeight: 48 }}
        >
          <Icon name="logout" size={16} />
          退出登录
        </button>
      </div>
    </>
  );

  return (
    <>
      <div
        className={`mobile-menu-overlay ${isOpen ? 'active' : ''}`}
        onClick={handleOverlayClick}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 90,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.25s ease, visibility 0.25s ease',
        }}
      />

      {state.mode === 'sidebar' ? (
        <div
          ref={menuRef}
          className={`mobile-sidebar ${isOpen ? 'open' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            bottom: 0,
            width: Math.min(280, window.innerWidth - 56),
            background: 'var(--color-surface)',
            borderRight: '1px solid var(--color-border)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isOpen ? '4px 0 24px rgba(0, 0, 0, 0.2)' : 'none',
          }}
        >
          {menuContent}
        </div>
      ) : (
        <div
          ref={menuRef}
          className={`mobile-bottom-sheet ${isOpen ? 'open' : ''}`}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '85vh',
            background: 'var(--color-surface)',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isOpen ? '0 -4px 24px rgba(0, 0, 0, 0.2)' : 'none',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              background: 'var(--color-border)',
              borderRadius: 2,
              margin: '12px auto',
              flexShrink: 0,
            }}
          />
          {menuContent}
        </div>
      )}

      <button
        className="mobile-menu-fab"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 16,
          background: 'var(--gradient-brand)',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 80,
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
          cursor: 'pointer',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          touchAction: 'manipulation',
        }}
      >
        {isOpen ? (
          <Icon name="close" size={24} color="#ffffff" />
        ) : (
          <Icon name="menu" size={24} color="#ffffff" />
        )}
      </button>
    </>
  );
}

export { menuStructure };
export type { MenuItem, MenuMode };
