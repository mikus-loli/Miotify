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
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle at 30% 30%, rgba(99, 102, 241, 0.08) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-scale-in" style={{
        width: '100%',
        maxWidth: 400,
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: 40,
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            background: 'var(--gradient-brand)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            marginBottom: 20,
            boxShadow: '0 12px 40px rgba(99, 102, 241, 0.35)',
          }}>
            📡
          </div>
          <h1 className="brand-text" style={{ fontSize: 32, marginBottom: 8 }}>
            Miotify
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 15 }}>
            实时消息推送服务
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: 32,
            boxShadow: '0 8px 40px var(--color-shadow)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 8,
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
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 8,
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
                className="btn btn-primary btn-lg"
                type="submit"
                disabled={loading || !name.trim() || !pass.trim()}
                style={{
                  width: '100%',
                  marginTop: 8,
                }}
              >
                {loading ? <span className="loading-spinner" /> : '登录'}
              </button>
            </div>
          </div>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 13,
          color: 'var(--color-text-muted)',
        }}>
          Miotify · 轻量级消息推送服务
        </p>
      </div>
    </div>
  );
}
