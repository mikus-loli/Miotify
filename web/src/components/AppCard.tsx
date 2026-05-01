import { useState, useRef } from 'react';
import type { Application } from '@/types';
import { formatTime } from '@/utils/format';

interface Props {
  app: Application;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: { name?: string; description?: string }) => void;
  onUploadImage: (id: number, file: File) => void;
  onDeleteImage: (id: number) => void;
}

export default function AppCard({ app, onDelete, onUpdate, onUploadImage, onDeleteImage }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(app.name);
  const [editDesc, setEditDesc] = useState(app.description);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB');
        return;
      }
      onUploadImage(app.id, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {app.image ? (
            <img
              src={app.image}
              alt={app.name}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                objectFit: 'cover',
                border: '1px solid var(--color-border)',
              }}
            />
          ) : (
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'var(--color-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}>
              📱
            </div>
          )}
          <div>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>{app.name}</span>
            <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--color-text-muted)', background: 'var(--color-surface-secondary)', padding: '2px 8px', borderRadius: 6 }}>
              #{app.id}
            </span>
          </div>
        </div>
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

      {expanded && (
        <div className="animate-slide-down" style={{ marginTop: 20 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                  应用名称
                </label>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                  应用描述
                </label>
                <input className="input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSave}>保存</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>取消</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
                <div style={{ position: 'relative' }}>
                  {app.image ? (
                    <img
                      src={app.image}
                      alt={app.name}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 14,
                        objectFit: 'cover',
                        border: '1px solid var(--color-border)',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      background: 'var(--color-primary-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 32,
                    }}>
                      📱
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  {app.description && (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 10, lineHeight: 1.6 }}>
                      {app.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleImageSelect}
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {app.image ? '🔄 更换图标' : '📤 上传图标'}
                    </button>
                    {app.image && (
                      <button className="btn btn-ghost btn-sm" onClick={() => onDeleteImage(app.id)}>
                        🗑️ 删除图标
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div style={{
                background: 'var(--color-input-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '12px 16px',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
                wordBreak: 'break-all',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}>
                <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Token
                </span>
                <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{app.token}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCopyToken}
                  style={{ padding: '4px 12px', fontSize: 12 }}
                >
                  {copied ? '✓ 已复制' : '复制'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>✏️ 编辑</button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(app.id)}>🗑️ 删除</button>
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  创建于 {formatTime(app.created_at)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
