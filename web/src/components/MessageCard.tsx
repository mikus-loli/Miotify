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
  const isLong = message.message && message.message.length > 120;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: app?.image ? 'transparent' : 'var(--color-primary-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {app?.image ? (
              <img src={app.image} alt={app.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 10 }} />
            ) : (
              '💬'
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{message.title || '通知'}</span>
              {priorityBadge(message.priority)}
              {app && (
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {app.name}
                </span>
              )}
            </div>
            <p style={{
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6,
              margin: 0,
              wordBreak: 'break-word',
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
                  fontSize: 12,
                  padding: '4px 0',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {expanded ? '收起' : '展开全文'}
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {formatTime(message.created_at)}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(message.id)}
            style={{ padding: '4px 8px', fontSize: 11, minWidth: 0 }}
            title="删除"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
