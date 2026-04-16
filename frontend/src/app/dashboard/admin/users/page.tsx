'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Plus, RefreshCw, LogOut, Pencil, KeyRound, Check, X } from 'lucide-react';

type Role = 'admin' | 'support' | 'sales' | 'client';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Администратор',
  support: 'Поддержка',
  sales: 'Продажи',
  client: 'Клиент',
};

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/30',
  support: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  sales: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  client: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500';
const selectCls = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500';

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  // form states
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'client' as Role, password: '' });
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', role: 'client' as Role, isActive: true });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
    if (user) load();
  }, [user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<User[]>('/users');
      setUsers(data);
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      toast.error('Заполните все поля');
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('Пользователь создан');
      setShowCreate(false);
      setForm({ email: '', firstName: '', lastName: '', role: 'client', password: '' });
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Ошибка создания');
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await api.patch(`/users/${editUser.id}`, editForm);
      toast.success('Сохранено');
      setEditUser(null);
      await load();
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!resetUser || !newPassword) { toast.error('Введите новый пароль'); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${resetUser.id}/reset-password`, { password: newPassword });
      toast.success('Пароль изменён');
      setResetUser(null);
      setNewPassword('');
    } catch { toast.error('Ошибка'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u: User) => {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? 'Аккаунт деактивирован' : 'Аккаунт активирован');
      await load();
    } catch { toast.error('Ошибка'); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/admin')} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <span className="font-semibold">Tinta Smart</span>
            <span className="text-slate-500 text-sm">/ Admin / Пользователи</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={14} /> Создать
            </button>
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-slate-400 text-sm mt-1">{users.length} аккаунтов</p>
        </div>

        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Пользователь</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Роль</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Статус</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Создан</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Загрузка...</td></tr>
              ) : users.map((u, i) => (
                <tr key={u.id} className={`${i < users.length - 1 ? 'border-b border-slate-700/30' : ''} hover:bg-slate-800/30 transition-colors`}>
                  <td className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`flex items-center gap-1 text-xs ${u.isActive ? 'text-green-400' : 'text-slate-500'} hover:opacity-70 transition-opacity`}
                    >
                      {u.isActive ? <Check size={13} /> : <X size={13} />}
                      {u.isActive ? 'Активен' : 'Неактивен'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setEditUser(u); setEditForm({ firstName: u.firstName, lastName: u.lastName, role: u.role, isActive: u.isActive }); }}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                        title="Редактировать"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setResetUser(u)}
                        className="text-slate-400 hover:text-amber-400 transition-colors p-1"
                        title="Сменить пароль"
                      >
                        <KeyRound size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Create modal */}
      {showCreate && (
        <Modal title="Новый пользователь" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя">
                <input className={inputCls} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Имя" />
              </Field>
              <Field label="Фамилия">
                <input className={inputCls} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Фамилия" />
              </Field>
            </div>
            <Field label="Email">
              <input className={inputCls} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
            </Field>
            <Field label="Пароль">
              <input className={inputCls} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Минимум 8 символов" />
            </Field>
            <Field label="Роль">
              <select className={selectCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                <option value="client">Клиент</option>
                <option value="support">Поддержка</option>
                <option value="sales">Продажи</option>
                <option value="admin">Администратор</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">Отмена</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editUser && (
        <Modal title="Редактировать пользователя" onClose={() => setEditUser(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя">
                <input className={inputCls} value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
              </Field>
              <Field label="Фамилия">
                <input className={inputCls} value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
              </Field>
            </div>
            <Field label="Роль">
              <select className={selectCls} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as Role }))}>
                <option value="client">Клиент</option>
                <option value="support">Поддержка</option>
                <option value="sales">Продажи</option>
                <option value="admin">Администратор</option>
              </select>
            </Field>
            <Field label="Статус">
              <select className={selectCls} value={editForm.isActive ? 'active' : 'inactive'} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.value === 'active' }))}>
                <option value="active">Активен</option>
                <option value="inactive">Деактивирован</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">Отмена</button>
              <button onClick={handleEdit} disabled={saving} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <Modal title={`Пароль: ${resetUser.firstName} ${resetUser.lastName}`} onClose={() => { setResetUser(null); setNewPassword(''); }}>
          <div className="space-y-4">
            <Field label="Новый пароль">
              <input className={inputCls} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Минимум 8 символов" autoFocus />
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setResetUser(null); setNewPassword(''); }} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">Отмена</button>
              <button onClick={handleResetPassword} disabled={saving} className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? 'Сохранение...' : 'Сменить пароль'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
