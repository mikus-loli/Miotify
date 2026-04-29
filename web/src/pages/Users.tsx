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
                {editingUserId === user.id && editMode === 'name' ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input"
                      placeholder="新用户名"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ width: 150 }}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSaveName(user.id)}
                      disabled={!editName.trim()}
                    >
                      保存
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                      取消
                    </button>
                  </div>
                ) : (
                  <span style={{ fontWeight: 500 }}>{user.name}</span>
                )}
                {user.admin ? (
                  <span className="badge badge-primary">管理员</span>
                ) : (
                  <span className="badge badge-success">普通用户</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  创建于 {formatTime(user.created_at)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(currentUser?.id === user.id || currentUser?.admin) && (
                  editingUserId === user.id && editMode === 'password' ? (
                    <>
                      <input
                        className="input"
                        type="password"
                        placeholder="新密码"
                        value={editPass}
                        onChange={(e) => setEditPass(e.target.value)}
                        style={{ width: 150 }}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSavePassword(user.id)}
                        disabled={!editPass.trim()}
                      >
                        保存
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                        取消
                      </button>
                    </>
                  ) : editingUserId !== user.id && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEditName(user.id, user.name)}
                      >
                        修改用户名
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEditPassword(user.id)}
                      >
                        修改密码
                      </button>
                    </>
                  )
                )}
                {currentUser?.id !== user.id && editingUserId !== user.id && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(user.id)}
                  >
                    删除
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
