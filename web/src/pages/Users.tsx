import { useEffect, useState } from 'react';
import { useUserStore } from '@/store/users';
import { useAuthStore } from '@/store/auth';

export default function UsersPage() {
  const { users, loading, fetchUsers, createUser, deleteUser } = useUserStore();
  const currentUser = useAuthStore((s) => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newAdmin, setNewAdmin] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    if (!newName.trim() || !newPass.trim()) return;
    const ok = await createUser({ name: newName.trim(), pass: newPass, admin: newAdmin });
    if (ok) {
      setNewName('');
      setNewPass('');
      setNewAdmin(false);
      setShowCreate(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteUser(id);
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
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>用户管理</h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {users.length} 个用户
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '取消' : '+ 创建用户'}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>创建新用户</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              className="input"
              placeholder="用户名"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="密码"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={newAdmin}
                onChange={(e) => setNewAdmin(e.target.checked)}
              />
              管理员
            </label>
            <div>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!newName.trim() || !newPass.trim()}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <span className="loading-spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {users.map((user) => (
            <div
              key={user.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 500 }}>{user.name}</span>
                {user.admin ? (
                  <span className="badge badge-primary">管理员</span>
                ) : (
                  <span className="badge badge-success">普通用户</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  创建于 {user.created_at}
                </span>
              </div>
              {currentUser?.id !== user.id && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(user.id)}
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
