import { useEffect, useState } from 'react';
import { usePluginStore } from '@/store/plugins';
import type { Plugin } from '@/types';

function ConfigEditor({ config, onChange }: { config: Record<string, unknown>; onChange: (config: Record<string, unknown>) => void }) {
  const selectOptions: Record<string, { label: string; value: string }[]> = {
    targetType: [
      { label: '私聊', value: 'private' },
      { label: '群聊', value: 'group' },
    ],
  };

  const fieldLabels: Record<string, string> = {
    httpUrl: 'HTTP 地址',
    accessToken: 'Access Token',
    targetType: '目标类型',
    targetId: '目标 ID (QQ号/群号)',
    messageTemplate: '消息模板',
    minPriority: '最低优先级',
    enabledApps: '启用的应用ID',
    timeout: '超时时间(ms)',
    forwardAllApps: '转发所有应用',
    smtp: 'SMTP 配置',
    host: '主机',
    port: '端口',
    secure: 'SSL/TLS',
    auth: '认证',
    user: '用户名',
    pass: '密码',
    from: '发件人',
    to: '收件人',
    subject: '主题模板',
  };

  const renderField = (key: string, value: unknown, path: string[] = []): React.ReactNode => {
    const fullPath = [...path, key];
    const fieldKey = fullPath.join('.');
    const label = fieldLabels[key] || key;

    if (value === null || value === undefined) return null;

    if (selectOptions[key]) {
      return (
        <div key={fieldKey} style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            {label}
          </label>
          <select
            className="input"
            value={String(value)}
            onChange={(e) => {
              const newConfig = { ...config };
              let current: Record<string, unknown> = newConfig;
              for (let i = 0; i < path.length; i++) current = current[path[i]] as Record<string, unknown>;
              current[key] = e.target.value;
              onChange(newConfig);
            }}
            style={{ width: 'auto', minWidth: 160 }}
          >
            {selectOptions[key].map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <label key={fieldKey} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={value} onChange={(e) => {
            const newConfig = { ...config };
            let current: Record<string, unknown> = newConfig;
            for (let i = 0; i < path.length; i++) current = current[path[i]] as Record<string, unknown>;
            current[key] = e.target.checked;
            onChange(newConfig);
          }} />
          <span style={{ fontSize: 14 }}>{label}</span>
        </label>
      );
    }

    if (typeof value === 'number') {
      return (
        <div key={fieldKey} style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            {label}
          </label>
          <input
            className="input"
            type="number"
            value={value}
            onChange={(e) => {
              const newConfig = { ...config };
              let current: Record<string, unknown> = newConfig;
              for (let i = 0; i < path.length; i++) current = current[path[i]] as Record<string, unknown>;
              current[key] = parseFloat(e.target.value) || 0;
              onChange(newConfig);
            }}
            style={{ width: 160 }}
          />
        </div>
      );
    }

    if (typeof value === 'string') {
      const isSecret = key.toLowerCase().includes('password') || key.toLowerCase().includes('pass') || key.toLowerCase().includes('token');
      const isTemplate = key.toLowerCase().includes('template');
      return (
        <div key={fieldKey} style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
            {label}
          </label>
          {isTemplate ? (
            <textarea
              className="input"
              value={value}
              onChange={(e) => {
                const newConfig = { ...config };
                let current: Record<string, unknown> = newConfig;
                for (let i = 0; i < path.length; i++) current = current[path[i]] as Record<string, unknown>;
                current[key] = e.target.value;
                onChange(newConfig);
              }}
              rows={3}
              style={{ width: '100%', resize: 'vertical' }}
            />
          ) : (
            <input
              className="input"
              type={isSecret ? 'password' : 'text'}
              value={value}
              onChange={(e) => {
                const newConfig = { ...config };
                let current: Record<string, unknown> = newConfig;
                for (let i = 0; i < path.length; i++) current = current[path[i]] as Record<string, unknown>;
                current[key] = e.target.value;
                onChange(newConfig);
              }}
            />
          )}
        </div>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0 || typeof value[0] !== 'object') {
        return (
          <div key={fieldKey} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              {label} {value.length > 0 && typeof value[0] === 'number' ? '(逗号分隔的数字)' : '(逗号分隔)'}
            </label>
            <input
              className="input"
              type="text"
              value={value.join(', ')}
              onChange={(e) => {
                const newConfig = { ...config };
                let current: Record<string, unknown> = newConfig;
                for (let i = 0; i < path.length; i++) current = current[path[i]] as Record<string, unknown>;
                if (value.length > 0 && typeof value[0] === 'number') {
                  current[key] = e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                } else {
                  current[key] = e.target.value.split(',').map((s) => s.trim()).filter((s) => s);
                }
                onChange(newConfig);
              }}
              placeholder={value.length > 0 && typeof value[0] === 'number' ? '1, 2, 3' : 'item1, item2, item3'}
            />
          </div>
        );
      }
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div key={fieldKey} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: 'var(--color-text)' }}>
            {label}
          </div>
          <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--color-primary-bg)' }}>
            {Object.entries(value as Record<string, unknown>).map(([k, v]) => renderField(k, v, fullPath))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div>
      {Object.entries(config).map(([key, value]) => renderField(key, value))}
    </div>
  );
}

function PluginCard({ plugin, onRefresh }: { plugin: Plugin; onRefresh: () => void }) {
  const { setPluginEnabled, setPluginConfig, setPluginPriority } = usePluginStore();
  const [toggling, setToggling] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Record<string, unknown> | null>(null);
  const [saving, setSaving] = useState(false);
  const [priority, setPriority] = useState(plugin.priority);

  const handleToggle = async () => {
    setToggling(true);
    await setPluginEnabled(plugin.id, !plugin.enabled);
    setToggling(false);
  };

  const handleSaveConfig = async () => {
    if (!editingConfig) return;
    setSaving(true);
    await setPluginConfig(plugin.id, editingConfig);
    setEditingConfig(null);
    setSaving(false);
  };

  const handleSavePriority = async () => {
    await setPluginPriority(plugin.id, priority);
    onRefresh();
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: plugin.enabled ? 'var(--color-primary-bg)' : 'var(--color-surface-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
          }}>
            🧩
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>{plugin.name}</span>
              <span className="badge badge-info">v{plugin.version}</span>
              {plugin.enabled ? (
                <span className="badge badge-success">运行中</span>
              ) : (
                <span className="badge" style={{ background: 'var(--color-surface-secondary)', color: 'var(--color-text-muted)' }}>已停用</span>
              )}
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {plugin.description}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} onClick={(e) => e.stopPropagation()}>
          <button
            className={`btn ${plugin.enabled ? 'btn-danger' : 'btn-primary'} btn-sm`}
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? <span className="loading-spinner" /> : plugin.enabled ? '停用' : '启用'}
          </button>
          <span style={{
            color: 'var(--color-text-muted)',
            fontSize: 14,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}>
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div className="animate-slide-down" style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--color-border)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 24, fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, flexWrap: 'wrap' }}>
            <span>👤 {plugin.author || '未知'}</span>
            {plugin.license && <span>📜 {plugin.license}</span>}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>ID: {plugin.id}</span>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              优先级
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                className="input"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
                style={{ width: 100 }}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleSavePriority}>保存</button>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>数值越小越先执行</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>配置</h4>
              {editingConfig && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingConfig(null)}>取消</button>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveConfig} disabled={saving}>
                    {saving ? <span className="loading-spinner" /> : '保存配置'}
                  </button>
                </div>
              )}
            </div>

            {editingConfig ? (
              <div style={{
                background: 'var(--color-input-bg)',
                padding: 20,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--color-border)',
              }}>
                <ConfigEditor config={editingConfig} onChange={setEditingConfig} />
              </div>
            ) : (
              <div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditingConfig({ ...plugin.config })}
                  style={{ marginBottom: 12 }}
                >
                  ✏️ 编辑配置
                </button>
                <pre style={{
                  background: 'var(--color-input-bg)',
                  padding: 16,
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 240,
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {JSON.stringify(plugin.config, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PluginsPage() {
  const { plugins, loading, fetchPlugins } = usePluginStore();

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const enabledCount = plugins.filter(p => p.enabled).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>插件管理</h1>
          <p className="page-header-subtitle">
            {plugins.length} 个插件 · {enabledCount} 个已启用
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => fetchPlugins()}>
          🔄 刷新
        </button>
      </div>

      {loading && plugins.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <span className="loading-spinner loading-spinner-lg" />
        </div>
      ) : plugins.length === 0 ? (
        <div className="empty-state">
          <p>🧩</p>
          <p>暂无插件</p>
          <p>将插件放入 plugins/available 目录</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {plugins.map((plugin, i) => (
            <div key={plugin.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 0.05, 0.4)}s`, opacity: 0 }}>
              <PluginCard plugin={plugin} onRefresh={fetchPlugins} />
            </div>
          ))}
        </div>
      )}

      <div className="section-card" style={{ marginTop: 32 }}>
        <h3 className="section-title">开发插件</h3>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 14, lineHeight: 1.7 }}>
          插件是 Node.js 模块，放置在 <code style={{ background: 'var(--color-input-bg)', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontFamily: 'var(--font-mono)' }}>plugins/available/</code> 目录下。
        </p>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 10, fontWeight: 500 }}>
          可用钩子：
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            { hook: 'message:beforeSend', desc: '消息发送前（可修改或拒绝）' },
            { hook: 'message:afterSend', desc: '消息发送后' },
            { hook: 'user:onCreate', desc: '用户创建时' },
            { hook: 'app:onCreate', desc: '应用创建时' },
          ].map((item) => (
            <div key={item.hook} style={{ display: 'flex', gap: 12, fontSize: 13 }}>
              <code style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{item.hook}</code>
              <span style={{ color: 'var(--color-text-muted)' }}>— {item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
