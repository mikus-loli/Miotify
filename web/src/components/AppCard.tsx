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
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {app.image ? (
            <img
              src={app.image}
              alt={app.name}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                objectFit: 'cover',
                border: '1px solid var(--color-border)',
              }}
            />
          ) : (
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: 'var(--color-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>
              📱
            </div>
          )}
          <div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{app.name}</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
              #{app.id}
            </span>
          </div>
        </div>
        <span style={{
          color: 'var(--color-text-muted)',
          fontSize: 12,
          transition: 'transform 0.2s ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>
          ▼
        </span>
      </div>

      {expanded && (
        <div className="animate-slide-down" style={{ marginTop: 16 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  应用名称
                </label>
                <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  应用描述
                </label>
                <input className="input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={handleSave}>保存</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>取消</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  {app.image ? (
                    <img
                      src={app.image}
                      alt={app.name}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        objectFit: 'cover',
                        border: '1px solid var(--color-border)',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      background: 'var(--color-primary-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}>
                      📱
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  {app.description && (
                    <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                      {app.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                padding: '10px 14px',
                fontSize: 12,
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ color: 'var(--color-text-muted)', flexShrink: 0, fontSize: 11, fontWeight: 600, textTransform: 'uppercase' }}>
                  Token
                </span>
                <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>{app.token}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleCopyToken}
                  style={{ padding: '3px 10px', fontSize: 11 }}
                >
                  {copied ? '✓ 已复制' : '复制'}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>✏️ 编辑</button>
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(app.id)}>🗑️ 删除</button>
                </div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
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
