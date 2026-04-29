import { useState } from 'react';
import type { Application } from '@/types';

interface Props {
  app: Application;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: { name?: string; description?: string }) => void;
}

export default function AppCard({ app, onDelete, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(app.name);
  const [editDesc, setEditDesc] = useState(app.description);
  const [copied, setCopied] = useState(false);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(app.token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSave = () => {
    onUpdate(app.id, { name: editName, description: editDesc });
    setEditing(false);
  };

  return (
    <div className="card">
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{app.name}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
            ID: {app.id}
          </span>
        </div>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                className="input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="应用名称"
              />
              <input
                className="input"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="应用描述"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSave}>保存</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>取消</button>
              </div>
            </div>
          ) : (
            <>
              {app.description && (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 8 }}>
                  {app.description}
                </p>
              )}
              <div style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                fontSize: 12,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>Token:</span>
                <span style={{ flex: 1 }}>{app.token}</span>
                <button className="btn btn-ghost btn-sm" onClick={handleCopyToken}>
                  {copied ? '✓' : '复制'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>编辑</button>
                <button className="btn btn-danger btn-sm" onClick={() => onDelete(app.id)}>删除</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                创建时间: {app.created_at}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
