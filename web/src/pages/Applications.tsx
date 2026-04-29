import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/apps';
import AppCard from '@/components/AppCard';

export default function ApplicationsPage() {
  const { apps, loading, fetchApps, createApp, deleteApp, updateApp, uploadAppImage, deleteAppImage } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createApp({ name: newName.trim(), description: newDesc });
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  const handleDelete = async (id: number) => {
    await deleteApp(id);
  };

  const handleUpdate = async (id: number, data: { name?: string; description?: string }) => {
    await updateApp(id, data);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>应用</h1>
          <p className="page-header-subtitle">{apps.length} 个应用</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '取消' : '+ 创建应用'}
        </button>
      </div>

      {showCreate && (
        <div className="section-card animate-slide-down">
          <h3 className="section-title">创建新应用</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                应用名称
              </label>
              <input
                className="input"
                placeholder="例如：My App"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                应用描述
              </label>
              <input
                className="input"
                placeholder="可选的应用描述"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <span className="loading-spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : apps.length === 0 ? (
        <div className="empty-state">
          <p>📱</p>
          <p>暂无应用，点击上方按钮创建</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {apps.map((app, i) => (
            <div key={app.id} className="animate-fade-in" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s`, opacity: 0 }}>
              <AppCard
                app={app}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onUploadImage={uploadAppImage}
                onDeleteImage={deleteAppImage}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
