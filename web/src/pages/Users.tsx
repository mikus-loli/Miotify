import { useEffect, useState } from 'react';
import { useUserStore } from '@/store/users';
import { useAuthStore } from '@/store/auth';
import { api } from '@/api/client';
import { formatTime } from '@/utils/format';

export default function UsersPage() {
  const { users, loading, fetchUsers, createUser, deleteUser } = useUserStore();
  const currentUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newAdmin, setNewAdmin] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPass, setEditPass] = useState('');
  const [editMode, setEditMode] = useState<'name' | 'password' | null>(null);

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

  const startEditName = (userId: number, currentName: string) => {
    setEditingUserId(userId);
    setEditName(currentName);
    setEditPass('');
    setEditMode('name');
  };

  const startEditPassword = (userId: number) => {
    setEditingUserId(userId);
    setEditName('');
    setEditPass('');
    setEditMode('password');
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditName('');
    setEditPass('');
    setEditMode(null);
  };

  const handleSaveName = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await api.updateUser(id, editName.trim(), token!);
      await fetchUsers();
      cancelEdit();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleSavePassword = async (id: number) => {
    if (!editPass.trim()) return;
    try {
      await api.updatePassword(id, editPass, token!);
      cancelEdit();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>用户管理</h1>
          <p className="page-header-subtitle">{users.length} 个用户</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? '取消' : '+ 创建用户'}
        </button>
      </div>

      {showCreate && (
        <div className="section-card animate-slide-down">
          <h3 className="section-title">创建新用户</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                用户名
              </label>
              <input
                className="input"
                placeholder="请输入用户名"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                密码
              </label>
              <input
                className="input"
                type="password"
                placeholder="请输入密码"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={newAdmin} onChange={(e) => setNewAdmin(e.target.checked)} />
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
        <div style={{ textAlign: 'center', padding: 64 }}>
          <span className="loading-spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {users.map((user, i) => (
            <div
              key={user.id}
              className="card animate-fade-in"
              style={{
                padding: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                animationDelay: `${Math.min(i * 0.04, 0.3)}s`,
                opacity: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: user.admin ? 'var(--color-primary-bg)' : 'var(--color-success-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  flexShrink: 0,
                  color: user.admin ? 'var(--color-primary)' : 'var(--color-success)',
                  fontWeight: 700,
                }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editingUserId === user.id && editMode === 'name' ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          className="input"
                          placeholder="新用户名"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          style={{ width: 140 }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveName(user.id)} disabled={!editName.trim()}>
                          保存
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>取消</button>
                      </div>
                    ) : (
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</span>
                    )}
                    {user.admin ? (
                      <span className="badge badge-primary">管理员</span>
                    ) : (
                      <span className="badge badge-success">普通用户</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, display: 'block' }}>
                    创建于 {formatTime(user.created_at)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {(currentUser?.id === user.id || currentUser?.admin) && (
                  editingUserId === user.id && editMode === 'password' ? (
                    <>
                      <input
                        className="input"
                        type="password"
                        placeholder="新密码"
                        value={editPass}
                        onChange={(e) => setEditPass(e.target.value)}
                        style={{ width: 140 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => handleSavePassword(user.id)} disabled={!editPass.trim()}>
                        保存
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>取消</button>
                    </>
                  ) : editingUserId !== user.id && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEditName(user.id, user.name)}>
                        ✏️ 改名
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => startEditPassword(user.id)}>
                        🔑 改密
                      </button>
                    </>
                  )
                )}
                {currentUser?.id !== user.id && editingUserId !== user.id && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(user.id)}>
                    🗑️ 删除
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
