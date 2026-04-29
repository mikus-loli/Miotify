import { useEffect, useState } from 'react';
import { useMessageStore } from '@/store/messages';
import { useAppStore } from '@/store/apps';
import MessageCard from '@/components/MessageCard';

export default function MessagesPage() {
  const { messages, loading, fetchMessages, deleteMessage, filterAppId, setFilterAppId, subscribe } = useMessageStore();
  const { apps, fetchApps } = useAppStore();
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    fetchApps();
    fetchMessages();
    const unsub = subscribe();
    return unsub;
  }, [fetchApps, fetchMessages, subscribe]);

  useEffect(() => {
    const checkWs = setInterval(() => {
      setWsConnected(typeof WebSocket !== 'undefined');
    }, 3000);
    return () => clearInterval(checkWs);
  }, []);

  const filteredMessages = filterAppId
    ? messages.filter((m) => m.appid === filterAppId)
    : messages;

  const handleDelete = async (id: number) => {
    await deleteMessage(id);
  };

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
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>消息</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {wsConnected ? '🟢 实时连接中' : '⚪ 离线'} · {filteredMessages.length} 条消息
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="input"
            style={{ width: 'auto', minWidth: 140 }}
            value={filterAppId ?? ''}
            onChange={(e) => setFilterAppId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">全部应用</option>
            {apps.map((app) => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fetchMessages(filterAppId ?? undefined)}
          >
            刷新
          </button>
        </div>
      </div>

      {loading && messages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <span className="loading-spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 48 }}>📭</p>
          <p>暂无消息</p>
        </div>
      ) : (
        <div>
          {filteredMessages.map((msg) => (
            <MessageCard key={msg.id} message={msg} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
