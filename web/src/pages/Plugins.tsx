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

    if (value === null || value === undefined) {
      return null;
    }

    if (selectOptions[key]) {
      return (
        <div key={fieldKey} style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            {label}
          </label>
          <select
            className="input"
            value={String(value)}
            onChange={(e) => {
              const newConfig = { ...config };
              let current: Record<string, unknown> = newConfig;
              for (let i = 0; i < path.length; i++) {
                current = current[path[i]] as Record<string, unknown>;
              }
              current[key] = e.target.value;
              onChange(newConfig);
            }}
            style={{ width: 'auto', minWidth: 150 }}
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
        <label key={fieldKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => {
              const newConfig = { ...config };
              let current: Record<string, unknown> = newConfig;
              for (let i = 0; i < path.length; i++) {
                current = current[path[i]] as Record<string, unknown>;
              }
              current[key] = e.target.checked;
              onChange(newConfig);
            }}
          />
          <span style={{ fontSize: 13 }}>{label}</span>
        </label>
      );
    }

    if (typeof value === 'number') {
      return (
        <div key={fieldKey} style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            {label}
          </label>
          <input
            className="input"
            type="number"
            value={value}
            onChange={(e) => {
              const newConfig = { ...config };
              let current: Record<string, unknown> = newConfig;
              for (let i = 0; i < path.length; i++) {
                current = current[path[i]] as Record<string, unknown>;
              }
              current[key] = parseFloat(e.target.value) || 0;
              onChange(newConfig);
            }}
            style={{ width: 150 }}
          />
        </div>
      );
    }

    if (typeof value === 'string') {
      const isLongText = value.length > 50 || key.toLowerCase().includes('password') || key.toLowerCase().includes('pass') || key.toLowerCase().includes('template');
      return (
        <div key={fieldKey} style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
            {label}
          </label>
          {isLongText ? (
            key.toLowerCase().includes('template') ? (
              <textarea
                className="input"
                value={value}
                onChange={(e) => {
                  const newConfig = { ...config };
                  let current: Record<string, unknown> = newConfig;
                  for (let i = 0; i < path.length; i++) {
                    current = current[path[i]] as Record<string, unknown>;
                  }
                  current[key] = e.target.value;
                  onChange(newConfig);
                }}
                rows={3}
                style={{ width: '100%', resize: 'vertical' }}
              />
            ) : (
              <input
                className="input"
                type={key.toLowerCase().includes('password') || key.toLowerCase().includes('pass') ? 'password' : 'text'}
                value={value}
                onChange={(e) => {
                  const newConfig = { ...config };
                  let current: Record<string, unknown> = newConfig;
                  for (let i = 0; i < path.length; i++) {
                    current = current[path[i]] as Record<string, unknown>;
                  }
                  current[key] = e.target.value;
                  onChange(newConfig);
                }}
              />
            )
          ) : (
            <input
              className="input"
              type="text"
              value={value}
              onChange={(e) => {
                const newConfig = { ...config };
                let current: Record<string, unknown> = newConfig;
                for (let i = 0; i < path.length; i++) {
                  current = current[path[i]] as Record<string, unknown>;
                }
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
          <div key={fieldKey} style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              {label} {value.length > 0 && typeof value[0] === 'number' ? '(逗号分隔的数字)' : '(逗号分隔)'}
            </label>
            <input
              className="input"
              type="text"
              value={value.join(', ')}
              onChange={(e) => {
                const newConfig = { ...config };
                let current: Record<string, unknown> = newConfig;
                for (let i = 0; i < path.length; i++) {
                  current = current[path[i]] as Record<string, unknown>;
                }
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
        <div key={fieldKey} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--color-text)' }}>
            {label}
          </div>
          <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--color-border)' }}>
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
    <div className="card" style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{plugin.name}</span>
            <span className="badge badge-primary">v{plugin.version}</span>
            {plugin.enabled ? (
              <span className="badge badge-success">已启用</span>
            ) : (
              <span className="badge" style={{ background: 'var(--color-text-muted)', color: '#fff' }}>已禁用</span>
            )}
          </div>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 13,
            marginTop: 4,
          }}>
            {plugin.description}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={(e) => e.stopPropagation()}>
          <button
            className={`btn ${plugin.enabled ? 'btn-danger' : 'btn-primary'} btn-sm`}
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? '...' : plugin.enabled ? '禁用' : '启用'}
          </button>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: '1px solid var(--color-border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            display: 'flex',
            gap: 24,
            fontSize: 12,
            color: 'var(--color-text-muted)',
            marginBottom: 16,
            flexWrap: 'wrap',
          }}>
            <span>作者: {plugin.author}</span>
            {plugin.license && <span>许可: {plugin.license}</span>}
            <span>ID: {plugin.id}</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
              优先级
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="input"
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value, 10) || 0)}
                style={{ width: 100 }}
              />
              <button className="btn btn-ghost btn-sm" onClick={handleSavePriority}>
                保存
              </button>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                数值越小越先执行
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600 }}>配置</h4>
              {editingConfig && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingConfig(null)}>
                    取消
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={handleSaveConfig} disabled={saving}>
                    {saving ? '保存中...' : '保存配置'}
                  </button>
                </div>
              )}
            </div>

            {editingConfig ? (
              <div style={{
                background: 'var(--color-bg)',
                padding: 16,
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
                  编辑配置
                </button>
                <pre style={{
                  background: 'var(--color-bg)',
                  padding: 12,
                  borderRadius: 'var(--radius)',
                  fontSize: 12,
                  overflow: 'auto',
                  maxHeight: 200,
                  border: '1px solid var(--color-border)',
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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>插件管理</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {plugins.length} 个插件 · {enabledCount} 个已启用
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => fetchPlugins()}>
          刷新
        </button>
      </div>

      {loading && plugins.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <span className="loading-spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : plugins.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 48 }}>🔌</p>
          <p>暂无插件</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>将插件放入 plugins/available 目录</p>
        </div>
      ) : (
        <div>
          {plugins.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} onRefresh={fetchPlugins} />
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>开发插件</h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          插件是 Node.js 模块，放置在 <code style={{ background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4 }}>plugins/available/</code> 目录下。
        </p>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
          可用钩子：
        </p>
        <ul style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 20 }}>
          <li><code>message:beforeSend</code> - 消息发送前（可修改或拒绝）</li>
          <li><code>message:afterSend</code> - 消息发送后</li>
          <li><code>user:onCreate</code> - 用户创建时</li>
          <li><code>app:onCreate</code> - 应用创建时</li>
        </ul>
      </div>
    </div>
  );
}
