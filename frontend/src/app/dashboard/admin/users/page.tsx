'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Plus, RefreshCw, LogOut, Pencil, KeyRound, Check, X, Trash2 } from 'lucide-react';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

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

const ROLE_COLORS: Record<Role, string> = {
  admin:   'bg-red-500/15 text-red-400 border-red-500/30',
  support: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  sales:   'bg-amber-500/15 text-amber-400 border-amber-500/30',
  client:  'bg-teal-500/15 text-teal-400 border-teal-500/30',
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

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = (hasError = false) =>
  `w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
    hasError ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-teal-500'
  }`;
const selectCls = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500';

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', role: 'support' as Role, password: '' });
  const [formErrors, setFormErrors] = useState<Partial<Record<'email'|'firstName'|'lastName'|'password', string>>>({});
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', role: 'client' as Role, isActive: true });
  const [editEmailError, setEditEmailError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');

  const ROLE_LABELS: Record<Role, string> = {
    admin:   t('role_admin'),
    support: t('role_support'),
    sales:   t('role_sales'),
    client:  t('role_client'),
  };

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

  const validateForm = () => {
    const errs: typeof formErrors = {};
    if (!form.firstName.trim()) errs.firstName = t('err_required');
    if (!form.lastName.trim())  errs.lastName  = t('err_required');
    if (!form.email.trim())     errs.email     = t('err_required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t('err_email_invalid');
    if (!form.password)         errs.password  = t('err_required');
    else if (form.password.length < 8) errs.password = t('err_min8');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success(t('user_created_toast'));
      setShowCreate(false);
      setForm({ email: '', firstName: '', lastName: '', role: 'support', password: '' });
      setFormErrors({});
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      if (msg === 'Email already exists') toast.error(t('err_email_taken'));
      else toast.error(msg || t('error'));
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    if (editForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      setEditEmailError(t('err_email_invalid'));
      return;
    }
    if (!editForm.email.trim()) {
      setEditEmailError(t('err_required'));
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/users/${editUser.id}`, editForm);
      toast.success(t('user_saved_toast'));
      setEditUser(null);
      setEditEmailError('');
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      if (msg === 'Email already exists') toast.error(t('err_email_taken'));
      else toast.error(t('error'));
    } finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (!newPassword) { setPwError(t('err_required')); return; }
    if (newPassword.length < 8) { setPwError(t('err_min8')); return; }
    setSaving(true);
    try {
      await api.patch(`/users/${resetUser.id}/reset-password`, { password: newPassword });
      toast.success(t('pw_changed'));
      setResetUser(null);
      setNewPassword('');
      setPwError('');
    } catch { toast.error(t('error')); }
    finally { setSaving(false); }
  };

  const toggleActive = async (u: User) => {
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
      toast.success(u.isActive ? t('user_deactivated') : t('user_activated'));
      await load();
    } catch { toast.error(t('error')); }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deleteUser.id}`);
      toast.success(t('user_deleted_toast'));
      setDeleteUser(null);
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      toast.error(msg || t('error'));
    } finally { setDeleting(false); }
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
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-7 w-auto" />
            <span className="text-slate-500 text-sm">{t('users_breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={14} /> {t('create')}
            </button>
            <AppLanguageSwitcher />
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('users_h1')}</h1>
          <p className="text-slate-400 text-sm mt-1">{users.length} {t('admin_users').toLowerCase()}</p>
        </div>

        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_user')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_email_h')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_role')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_status')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_created_at')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">{t('loading')}</td></tr>
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
                      {u.isActive ? t('active') : t('inactive')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString('de-DE')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setEditUser(u); setEditForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role, isActive: u.isActive }); setEditEmailError(''); }}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                        title={t('edit')}
                      >
                        <Pencil size={14} />
                      </button>
                      {u.role !== 'client' && (
                        <button
                          onClick={() => setResetUser(u)}
                          className="text-slate-400 hover:text-amber-400 transition-colors p-1"
                          title={t('change_pw')}
                        >
                          <KeyRound size={14} />
                        </button>
                      )}
                      {u.id !== user.id && (
                        <button
                          onClick={() => setDeleteUser(u)}
                          className="text-slate-400 hover:text-red-400 transition-colors p-1"
                          title={t('delete')}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
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
        <Modal title={t('new_user_title')} onClose={() => { setShowCreate(false); setForm({ email: '', firstName: '', lastName: '', role: 'support', password: '' }); setFormErrors({}); }}>
          <form autoComplete="off" onSubmit={e => { e.preventDefault(); handleCreate(); }} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field label={<>{t('reg_firstname')} <span className="text-red-400">*</span></>}>
                <input
                  type="text"
                  autoComplete="off"
                  className={inputCls(!!formErrors.firstName)}
                  value={form.firstName}
                  onChange={e => { setForm(f => ({ ...f, firstName: e.target.value })); setFormErrors(err => ({ ...err, firstName: '' })); }}
                />
                {formErrors.firstName && <p className="text-red-400 text-xs mt-0.5">{formErrors.firstName}</p>}
              </Field>
              <Field label={<>{t('reg_lastname')} <span className="text-red-400">*</span></>}>
                <input
                  type="text"
                  autoComplete="off"
                  className={inputCls(!!formErrors.lastName)}
                  value={form.lastName}
                  onChange={e => { setForm(f => ({ ...f, lastName: e.target.value })); setFormErrors(err => ({ ...err, lastName: '' })); }}
                />
                {formErrors.lastName && <p className="text-red-400 text-xs mt-0.5">{formErrors.lastName}</p>}
              </Field>
            </div>
            <Field label={<>Email <span className="text-red-400">*</span></>}>
              <input
                type="text"
                inputMode="email"
                autoComplete="off"
                className={inputCls(!!formErrors.email)}
                value={form.email}
                onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setFormErrors(err => ({ ...err, email: '' })); }}
              />
              {formErrors.email && <p className="text-red-400 text-xs mt-0.5">{formErrors.email}</p>}
            </Field>
            <Field label={<>{t('reg_password')} <span className="text-red-400">*</span></>}>
              <input
                type="password"
                autoComplete="new-password"
                className={inputCls(!!formErrors.password)}
                value={form.password}
                onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setFormErrors(err => ({ ...err, password: '' })); }}
                placeholder={t('reg_hint_length')}
              />
              {formErrors.password && <p className="text-red-400 text-xs mt-0.5">{formErrors.password}</p>}
            </Field>
            <Field label={t('col_role')}>
              <select className={selectCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}>
                <option value="support">{t('role_support')}</option>
                <option value="sales">{t('role_sales')}</option>
                <option value="admin">{t('role_admin')}</option>
                <option value="client">{t('role_client')}</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setShowCreate(false); setFormErrors({}); }} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
              <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? t('creating') : t('create')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editUser && (
        <Modal title={t('edit_user_title')} onClose={() => { setEditUser(null); setEditEmailError(''); }}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('reg_firstname')}>
                <input className={inputCls()} value={editForm.firstName} onChange={e => setEditForm(f => ({ ...f, firstName: e.target.value }))} />
              </Field>
              <Field label={t('reg_lastname')}>
                <input className={inputCls()} value={editForm.lastName} onChange={e => setEditForm(f => ({ ...f, lastName: e.target.value }))} />
              </Field>
            </div>
            <Field label={<>Email <span className="text-red-400">*</span></>}>
              <input
                type="text"
                inputMode="email"
                autoComplete="off"
                className={inputCls(!!editEmailError)}
                value={editForm.email}
                onChange={e => { setEditForm(f => ({ ...f, email: e.target.value })); setEditEmailError(''); }}
              />
              {editEmailError && <p className="text-red-400 text-xs mt-0.5">{editEmailError}</p>}
            </Field>
            <Field label={t('col_role')}>
              <select className={selectCls} value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value as Role }))}>
                <option value="client">{t('role_client')}</option>
                <option value="support">{t('role_support')}</option>
                <option value="sales">{t('role_sales')}</option>
                <option value="admin">{t('role_admin')}</option>
              </select>
            </Field>
            <Field label={t('col_status')}>
              <select className={selectCls} value={editForm.isActive ? 'active' : 'inactive'} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.value === 'active' }))}>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </select>
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditUser(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
              <button onClick={handleEdit} disabled={saving} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reset password modal */}
      {resetUser && (
        <Modal title={`${t('pw_reset_title')}: ${resetUser.firstName} ${resetUser.lastName}`} onClose={() => { setResetUser(null); setNewPassword(''); setPwError(''); }}>
          <form autoComplete="off" onSubmit={e => { e.preventDefault(); handleResetPassword(); }} className="space-y-4">
            <Field label={<>{t('pw_enter_new')} <span className="text-red-400">*</span></>}>
              <input
                type="password"
                autoComplete="new-password"
                className={inputCls(!!pwError)}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwError(''); }}
                placeholder={t('reg_hint_length')}
                autoFocus
              />
              {pwError && <p className="text-red-400 text-xs mt-0.5">{pwError}</p>}
            </Field>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setResetUser(null); setNewPassword(''); setPwError(''); }} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
              <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? t('saving') : t('change_pw')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {deleteUser && (
        <Modal title={t('delete_user_title')} onClose={() => setDeleteUser(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              {t('delete')} <span className="font-medium text-white">{deleteUser.firstName} {deleteUser.lastName}</span>?
            </p>
            <p className="text-xs text-slate-500">{t('delete_irreversible')}</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeleteUser(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {deleting ? t('deleting') : t('delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
