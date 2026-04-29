import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ name, pass });
      navigate('/messages');
    } catch (err) {
      setError((err as Error).message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: 24,
    }}>
      <div className="animate-scale-in" style={{
        width: '100%',
        maxWidth: 380,
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: 32,
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'var(--gradient-brand)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            marginBottom: 16,
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.25)',
          }}>
            📡
          </div>
          <h1 className="brand-text" style={{ fontSize: 28, marginBottom: 6 }}>
            Miotify
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
            实时消息推送服务
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 28,
            boxShadow: '0 4px 24px var(--color-shadow)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
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
                  placeholder="请输入用户名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div>
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
                  placeholder="请输入密码"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {error && (
                <div className="error-text animate-slide-down">
                  {error}
                </div>
              )}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !name.trim() || !pass.trim()}
                style={{
                  width: '100%',
                  padding: '11px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  marginTop: 4,
                }}
              >
                {loading ? <span className="loading-spinner" /> : '登录'}
              </button>
            </div>
          </div>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: 20,
          fontSize: 12,
          color: 'var(--color-text-muted)',
        }}>
          Miotify · 轻量级消息推送服务
        </p>
      </div>
    </div>
  );
}
