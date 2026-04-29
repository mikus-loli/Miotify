import { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import ThemeToggle from '@/components/ThemeToggle';

export default function LoginPage() {
  const { login, loading, error, clearError } = useAuthStore();
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ name, pass });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
      }}>
        <ThemeToggle />
      </div>

      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '32px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 className="brand-text" style={{ fontSize: 32 }}>
            Miotify
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 8, fontSize: 14 }}>
            实时消息推送服务
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: 6,
            }}>
              用户名
            </label>
            <input
              className="input"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError(); }}
              placeholder="请输入用户名"
              autoComplete="username"
              required
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: 6,
            }}>
              密码
            </label>
            <input
              className="input"
              type="password"
              value={pass}
              onChange={(e) => { setPass(e.target.value); clearError(); }}
              placeholder="请输入密码"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="error-text" style={{ marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px 16px' }}
          >
            {loading ? <span className="loading-spinner" /> : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
