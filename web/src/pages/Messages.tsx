import { useEffect, useState } from 'react';
import { useMessageStore } from '@/store/messages';
import { useAppStore } from '@/store/apps';
import MessageCard from '@/components/MessageCard';

export default function MessagesPage() {
  const { messages, loading, fetchMessages, deleteMessage } = useMessageStore();
  const { apps, fetchApps } = useAppStore();
  const [filterApp, setFilterApp] = useState<number | 'all'>('all');

  useEffect(() => {
    fetchMessages();
    fetchApps();
  }, [fetchMessages, fetchApps]);

  const filtered = filterApp === 'all'
    ? messages
    : messages.filter((m) => m.appid === filterApp);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>消息</h1>
          <p className="page-header-subtitle">
            {messages.length} 条消息{filterApp !== 'all' ? ' · 筛选中' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="input"
            value={filterApp}
            onChange={(e) => setFilterApp(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{ width: 'auto', minWidth: 150 }}
          >
            <option value="all">全部应用</option>
            {apps.map((app) => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <span className="loading-spinner loading-spinner-lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>📭</p>
          <p>暂无消息</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {filtered.map((msg, i) => (
            <div key={msg.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s`, opacity: 0 }}>
              <MessageCard message={msg} onDelete={deleteMessage} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
