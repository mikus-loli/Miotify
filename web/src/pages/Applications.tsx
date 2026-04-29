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
    const result = await createApp({ name: newName.trim(), description: newDesc.trim() });
    if (result) {
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteApp(id);
  };

  const handleUpdate = async (id: number, data: { name?: string; description?: string }) => {
    await updateApp(id, data);
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
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>应用</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {apps.length} 个应用
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '取消' : '+ 创建应用'}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>创建新应用</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              className="input"
              placeholder="应用名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="input"
              placeholder="应用描述（可选）"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && apps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <span className="loading-spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : apps.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 48 }}>📱</p>
          <p>暂无应用，点击上方按钮创建</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onUploadImage={uploadAppImage}
              onDeleteImage={deleteAppImage}
            />
          ))}
        </div>
      )}
    </div>
  );
}
