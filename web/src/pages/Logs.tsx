import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { api } from '@/api/client';
import type { Log, LogStatsResponse } from '@/types';
import Icon from '@/components/Icon';
import { formatTime } from '@/utils/format';

const levelColors: Record<string, string> = {
  info: 'badge-info',
  warn: 'badge-warning',
  error: 'badge-danger',
  debug: 'badge-success',
};

const levelLabels: Record<string, string> = {
  info: '信息',
  warn: '警告',
  error: '错误',
  debug: '调试',
};

const categoryLabels: Record<string, string> = {
  auth: '认证',
  message: '消息',
  application: '应用',
  user: '用户',
  plugin: '插件',
  system: '系统',
};

const actionLabels: Record<string, string> = {
  login: '登录',
  login_failed: '登录失败',
  logout: '登出',
  create: '创建',
  delete: '删除',
  update: '更新',
  change_password: '修改密码',
  message_sent: '发送消息',
  message_rejected: '消息被拒绝',
  clear_logs: '清理日志',
  enable: '启用',
  disable: '禁用',
  config_update: '配置更新',
};

export default function LogsPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<Log[]>([]);
  const [stats, setStats] = useState<LogStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 50;

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        api.getLogs(token, { level: level || undefined, category: category || undefined, limit, offset: page * limit }),
        api.getLogStats(token),
      ]);
      setLogs(logsData.logs);
      setTotal(logsData.total);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, level, category, page]);

  const handleClearLogs = async () => {
    if (!token || !user?.admin) return;
    if (!confirm('确定要清除所有日志吗？此操作不可恢复。')) return;
    try {
      const result = await api.clearLogs(token);
      alert(`已删除 ${result.deleted} 条日志`);
      fetchData();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>系统日志</h1>
          <p className="page-header-subtitle">共 {total} 条日志</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="input"
            value={level}
            onChange={(e) => { setLevel(e.target.value); setPage(0); }}
            style={{ width: 'auto', minWidth: 100 }}
          >
            <option value="">全部级别</option>
            <option value="info">信息</option>
            <option value="warn">警告</option>
            <option value="error">错误</option>
            <option value="debug">调试</option>
          </select>
          <select
            className="input"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(0); }}
            style={{ width: 'auto', minWidth: 100 }}
          >
            <option value="">全部类别</option>
            <option value="auth">认证</option>
            <option value="message">消息</option>
            <option value="application">应用</option>
            <option value="user">用户</option>
            <option value="plugin">插件</option>
            <option value="system">系统</option>
          </select>
          {user?.admin && (
            <button className="btn btn-danger btn-sm" onClick={handleClearLogs}>
              <Icon name="trash" size={14} />
              清理日志
            </button>
          )}
        </div>
      </div>

      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-info)' }}>{stats.recentCount}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>24小时内</div>
          </div>
          {Object.entries(stats.levelStats).map(([lvl, cnt]) => (
            <div key={lvl} className="card" style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: `var(--color-${lvl === 'info' ? 'info' : lvl === 'warn' ? 'warning' : lvl === 'error' ? 'danger' : 'success'})` }}>{cnt}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>{levelLabels[lvl] || lvl}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <span className="loading-spinner loading-spinner-lg" />
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <p>📋</p>
          <p>暂无日志</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gap: 8 }}>
            {logs.map((log, i) => (
              <div
                key={log.id}
                className="card animate-fade-in"
                style={{
                  padding: 16,
                  cursor: 'pointer',
                  animationDelay: `${Math.min(i * 0.02, 0.3)}s`,
                  opacity: 0,
                }}
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                    <span className={`badge ${levelColors[log.level] || 'badge-info'}`}>
                      {levelLabels[log.level] || log.level}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'var(--color-surface-secondary)', padding: '2px 8px', borderRadius: 6 }}>
                      {categoryLabels[log.category] || log.category}
                    </span>
                    <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.message}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {log.user_name && (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{log.user_name}</span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {formatTime(log.created_at)}
                    </span>
                    <Icon name="chevronDown" size={14} color="var(--color-text-muted)" />
                  </div>
                </div>
                {expandedId === log.id && (
                  <div className="animate-slide-down" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                      <div>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>操作</span>
                        <div style={{ fontSize: 14, color: 'var(--color-text)' }}>{actionLabels[log.action] || log.action}</div>
                      </div>
                      {log.app_name && (
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>应用</span>
                          <div style={{ fontSize: 14, color: 'var(--color-text)' }}>{log.app_name}</div>
                        </div>
                      )}
                      {log.ip && (
                        <div>
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>IP</span>
                          <div style={{ fontSize: 14, color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{log.ip}</div>
                        </div>
                      )}
                    </div>
                    {Object.keys(log.details).length > 0 && (
                      <div>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>详细信息</span>
                        <pre style={{
                          background: 'var(--color-input-bg)',
                          padding: 12,
                          borderRadius: 'var(--radius)',
                          fontSize: 12,
                          overflow: 'auto',
                          marginTop: 6,
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-secondary)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 24 }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                上一页
              </button>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {page + 1} / {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
