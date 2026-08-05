'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, Plus, RefreshCw, LogOut, Pencil, Trash2, X, Wifi, WifiOff } from 'lucide-react';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

interface ServerWithClient {
  id: string;
  name: string;
  subdomain: string;
  tunnelId?: string;
  localUrl: string | null;
  status: 'online' | 'offline' | 'unknown';
  accessEnabled: boolean;
  accessExpiresAt: string | null;
  lastSeenAt: string | null;
  haVersion: string | null;
  client?: { id: string; user: { firstName: string; lastName: string; email: string } };
}

function StatusDot({ status }: { status: ServerWithClient['status'] }) {
  const map = {
    online: 'bg-green-400 shadow-[0_0_6px_2px] shadow-green-400/50',
    offline: 'bg-red-400',
    unknown: 'bg-slate-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${map[status]}`} />;
}

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

const inputCls = 'w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500';

interface Client { id: string; user: { firstName: string; lastName: string; email: string } }

export default function AdminServersPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();
  const [servers, setServers] = useState<ServerWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editServer, setEditServer] = useState<ServerWithClient | null>(null);
  const [deleteServer, setDeleteServer] = useState<ServerWithClient | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ clientId: '', name: '', subdomain: '', tunnelId: '', localUrl: '' });
  const [editForm, setEditForm] = useState({ name: '', subdomain: '', tunnelId: '', localUrl: '' });

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
    if (user) { load(); loadClients(); }
  }, [user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ServerWithClient[]>('/servers');
      setServers(data);
    } finally { setLoading(false); }
  };

  const loadClients = async () => {
    try {
      const { data } = await api.get<Client[]>('/clients');
      setClients(data);
    } catch {}
  };

  const handleCreate = async () => {
    if (!form.clientId || !form.name || !form.subdomain) {
      toast.error(t('err_required'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/servers', {
        clientId: form.clientId,
        name: form.name,
        subdomain: form.subdomain,
        tunnelId: form.tunnelId || undefined,
        localUrl: form.localUrl || undefined,
      });
      toast.success(t('server_added_toast'));
      setShowCreate(false);
      setForm({ clientId: '', name: '', subdomain: '', tunnelId: '', localUrl: '' });
      await load();
    } catch (e: any) {
      toast.error(e.response?.data?.message || t('error'));
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editServer) return;
    setSaving(true);
    try {
      await api.patch(`/servers/${editServer.id}`, {
        name: editForm.name,
        subdomain: editForm.subdomain,
        tunnelId: editForm.tunnelId || undefined,
        localUrl: editForm.localUrl || undefined,
      });
      toast.success(t('user_saved_toast'));
      setEditServer(null);
      await load();
    } catch { toast.error(t('error')); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteServer) return;
    setSaving(true);
    try {
      await api.delete(`/servers/${deleteServer.id}`);
      toast.success(t('server_deleted_toast'));
      setDeleteServer(null);
      await load();
    } catch { toast.error(t('error')); }
    finally { setSaving(false); }
  };

  if (!user) return null;

  const online = servers.filter(s => s.status === 'online').length;

  const statusText = (status: ServerWithClient['status']) =>
    status === 'online' ? t('client_status_online') :
    status === 'offline' ? t('client_status_offline') : t('client_status_unknown');

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/admin')} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-7 w-auto" />
            <span className="text-slate-500 text-sm">{t('servers_breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={14} /> {t('add')}
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
          <h1 className="text-2xl font-bold">{t('servers_h1')}</h1>
          <p className="text-slate-400 text-sm mt-1">{servers.length} · {online} online</p>
        </div>

        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_server')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_client_label')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_status')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_ha_ver')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">Subdomain</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">{t('loading')}</td></tr>
              ) : servers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  <WifiOff size={24} className="mx-auto mb-2 opacity-30" />
                  {t('server_none')}
                </td></tr>
              ) : servers.map((s, i) => (
                <tr key={s.id} className={`${i < servers.length - 1 ? 'border-b border-slate-700/30' : ''} hover:bg-slate-800/30 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusDot status={s.status} />
                      <span className="font-medium">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {s.client?.user ? `${s.client.user.firstName} ${s.client.user.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1 text-xs ${
                      s.status === 'online' ? 'text-green-400' :
                      s.status === 'offline' ? 'text-red-400' : 'text-slate-500'
                    }`}>
                      {s.status === 'online' ? <Wifi size={11} /> : <WifiOff size={11} />}
                      {statusText(s.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.haVersion || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs font-mono">{s.subdomain}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => { setEditServer(s); setEditForm({ name: s.name, subdomain: s.subdomain, tunnelId: (s as any).tunnelId || '', localUrl: s.localUrl || '' }); }}
                        className="text-slate-400 hover:text-white transition-colors p-1"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteServer(s)}
                        className="text-slate-400 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 size={14} />
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
        <Modal title={t('add_server_title')} onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('col_client_label')} *</label>
              <select className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">{t('field_client_opt')}</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.user.firstName} {c.user.lastName} ({c.user.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('field_server_name')} *</label>
              <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Haus Müller" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Subdomain *</label>
              <input className={inputCls} value={form.subdomain} onChange={e => setForm(f => ({ ...f, subdomain: e.target.value }))} placeholder="mueller.tinta-lab.de" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('field_local_url_label')}</label>
              <input className={inputCls} value={form.localUrl} onChange={e => setForm(f => ({ ...f, localUrl: e.target.value }))} placeholder="http://192.168.1.100:8123" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('field_tunnel_label')}</label>
              <input className={inputCls} value={form.tunnelId} onChange={e => setForm(f => ({ ...f, tunnelId: e.target.value }))} placeholder="uuid" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
              <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? t('adding') : t('add')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit modal */}
      {editServer && (
        <Modal title={`${t('edit')}: ${editServer.name}`} onClose={() => setEditServer(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('field_server_name')}</label>
              <input className={inputCls} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Subdomain</label>
              <input className={inputCls} value={editForm.subdomain} onChange={e => setEditForm(f => ({ ...f, subdomain: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('field_local_url_label')}</label>
              <input className={inputCls} value={editForm.localUrl} onChange={e => setEditForm(f => ({ ...f, localUrl: e.target.value }))} placeholder="http://192.168.1.100:8123" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('field_tunnel_label')}</label>
              <input className={inputCls} value={editForm.tunnelId} onChange={e => setEditForm(f => ({ ...f, tunnelId: e.target.value }))} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditServer(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
              <button onClick={handleEdit} disabled={saving} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteServer && (
        <Modal title={t('confirm_delete_server')} onClose={() => setDeleteServer(null)}>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              <span className="text-white font-medium">«{deleteServer.name}»</span> — {t('delete_server_warn')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteServer(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('cancel')}</button>
              <button onClick={handleDelete} disabled={saving} className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? t('deleting') : t('delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
