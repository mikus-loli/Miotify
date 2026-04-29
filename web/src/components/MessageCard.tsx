import type { Message } from '@/types';
import { useAppStore } from '@/store/apps';
import { useMessageStore } from '@/store/messages';
import { formatTime } from '@/utils/format';

interface Props {
  message: Message;
  onDelete: (id: number) => void;
}

function priorityBadge(priority: number) {
  if (priority >= 5) return <span className="badge badge-danger">高优先级</span>;
  if (priority >= 2) return <span className="badge badge-warning">中优先级</span>;
  return <span className="badge badge-success">低优先级</span>;
}

export default function MessageCard({ message, onDelete }: Props) {
  const apps = useAppStore((s) => s.apps);
  const deleting = useMessageStore((s) => s.loading);
  const app = apps.find((a) => a.id === message.appid);

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
            flexWrap: 'wrap',
          }}>
            {message.title && (
              <span style={{ fontWeight: 600, fontSize: 15 }}>{message.title}</span>
            )}
            {priorityBadge(message.priority)}
            {app && (
              <span className="badge badge-primary">{app.name}</span>
            )}
          </div>
          <p style={{
            color: 'var(--color-text-secondary)',
            fontSize: 14,
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}>
            {message.message}
          </p>
          <div style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--color-text-muted)',
          }}>
            {formatTime(message.created_at)}
          </div>
        </div>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onDelete(message.id)}
          disabled={deleting}
          title="删除消息"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
