import { useState } from 'react';
import type { Message } from '@/types';
import { useAppStore } from '@/store/apps';
import { formatTime } from '@/utils/format';

interface Props {
  message: Message;
  onDelete: (id: number) => void;
}

function priorityBadge(priority: number) {
  if (priority >= 5) return <span className="badge badge-danger">紧急</span>;
  if (priority >= 2) return <span className="badge badge-warning">一般</span>;
  return <span className="badge badge-success">低</span>;
}

export default function MessageCard({ message, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const apps = useAppStore((s) => s.apps);
  const app = apps.find((a) => a.id === message.appid);
  const isLong = message.message && message.message.length > 150;

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ display: 'flex', gap: 16, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: app?.image ? 'transparent' : 'var(--color-primary-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {app?.image ? (
              <img src={app.image} alt={app.name} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 12 }} />
            ) : (
              '💬'
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)' }}>{message.title || '通知'}</span>
              {priorityBadge(message.priority)}
              {app && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'var(--color-surface-secondary)', padding: '2px 8px', borderRadius: 6 }}>
                  {app.name}
                </span>
              )}
            </div>
            <p style={{
              fontSize: 14,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.7,
              margin: 0,
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              display: !expanded && isLong ? '-webkit-box' : 'block',
              WebkitLineClamp: !expanded && isLong ? 2 : undefined,
              WebkitBoxOrient: !expanded && isLong ? 'vertical' : undefined,
              overflow: !expanded && isLong ? 'hidden' : undefined,
            }}>
              {message.message}
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  fontSize: 13,
                  padding: '6px 0',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {expanded ? '收起' : '展开全文'}
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {formatTime(message.created_at)}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(message.id)}
            style={{ padding: '6px 10px', fontSize: 12, minWidth: 0 }}
            title="删除"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
