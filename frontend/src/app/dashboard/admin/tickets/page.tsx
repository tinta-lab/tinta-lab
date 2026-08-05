'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw, LogOut, ChevronDown, X } from 'lucide-react';
import { Ticket } from '@/types';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

const STATUS_COLORS: Record<Ticket['status'], string> = {
  new:            'bg-blue-500/15 text-blue-400 border-blue-500/30',
  in_progress:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  waiting_client: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  resolved:       'bg-green-500/15 text-green-400 border-green-500/30',
  closed:         'bg-slate-700/50 text-slate-500 border-slate-600',
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Ticket['status'] | 'all'>('all');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [editStatus, setEditStatus] = useState<Ticket['status']>('new');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const STATUS_LABELS: Record<Ticket['status'], string> = {
    new:            t('status_new_single'),
    in_progress:    t('status_in_progress_single'),
    waiting_client: t('status_waiting_client_single'),
    resolved:       t('status_resolved_single'),
    closed:         t('status_closed_single'),
  };

  const TYPE_LABELS: Record<Ticket['type'], string> = {
    installation: t('type_installation'),
    support:      t('type_support'),
    sales:        t('type_sales'),
    other:        t('type_other'),
  };

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'admin') router.push('/auth/login');
    if (user) load();
  }, [user, router]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Ticket[]>('/tickets');
      setTickets(data);
    } finally { setLoading(false); }
  };

  const openTicket = (ticket: Ticket) => {
    setSelected(ticket);
    setEditStatus(ticket.status);
    setEditNotes(ticket.internalNotes || '');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/tickets/${selected.id}/status`, {
        status: editStatus,
        internalNotes: editNotes,
      });
      toast.success(t('sales_ticket_updated'));
      setSelected(null);
      await load();
    } catch { toast.error(t('error')); }
    finally { setSaving(false); }
  };

  const filtered = filter === 'all' ? tickets : tickets.filter(ticket => ticket.status === filter);

  if (!user) return null;

  const counts = tickets.reduce((acc, ticket) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const StatusBadge = ({ status }: { status: Ticket['status'] }) => (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard/admin')} className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
            </button>
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-7 w-auto" />
            <span className="text-slate-500 text-sm">{t('tickets_breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
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
          <h1 className="text-2xl font-bold">{t('tickets_h1')}</h1>
          <p className="text-slate-400 text-sm mt-1">{tickets.length} · {counts['new'] || 0} {t('status_new_single').toLowerCase()}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['all', 'new', 'in_progress', 'waiting_client', 'resolved', 'closed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                filter === s
                  ? 'bg-teal-600 border-teal-500 text-white'
                  : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {s === 'all' ? t('filter_all_tickets') : STATUS_LABELS[s]}
              {s !== 'all' && counts[s] ? <span className="ml-1.5 opacity-70">{counts[s]}</span> : null}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_subject')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_contact')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_type_h')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_status')}</th>
                <th className="text-left px-4 py-3 text-xs text-slate-400 font-medium">{t('col_date_h')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">{t('loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">{t('no_tickets')}</td></tr>
              ) : filtered.map((ticket, i) => (
                <tr
                  key={ticket.id}
                  className={`${i < filtered.length - 1 ? 'border-b border-slate-700/30' : ''} hover:bg-slate-800/30 transition-colors cursor-pointer`}
                  onClick={() => openTicket(ticket)}
                >
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{ticket.subject}</td>
                  <td className="px-4 py-3 text-slate-400">
                    <div>{ticket.name}</div>
                    <div className="text-xs text-slate-600">{ticket.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{TYPE_LABELS[ticket.type]}</td>
                  <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(ticket.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-slate-600"><ChevronDown size={14} className="-rotate-90" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* Ticket detail modal */}
      {selected && (
        <Modal title={selected.subject} onClose={() => setSelected(null)}>
          <div className="space-y-5">
            {/* Contact info */}
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('contact_name')}</span>
                <span className="text-slate-300">{selected.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="text-slate-300">{selected.email}</span>
              </div>
              {selected.phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('contact_phone')}</span>
                  <span className="text-slate-300">{selected.phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">{t('col_type_h')}</span>
                <span className="text-slate-300">{TYPE_LABELS[selected.type]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('col_created_at')}</span>
                <span className="text-slate-300">
                  {new Date(selected.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Message */}
            <div>
              <div className="text-xs text-slate-400 mb-2">{t('sales_message')}</div>
              <p className="text-sm text-slate-300 bg-slate-900/50 rounded-xl p-4 whitespace-pre-wrap">{selected.message}</p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('col_status')}</label>
              <select
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
                value={editStatus}
                onChange={e => setEditStatus(e.target.value as Ticket['status'])}
              >
                {(Object.entries(STATUS_LABELS) as [Ticket['status'], string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Internal notes */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('sales_internal_notes')}</label>
              <textarea
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                rows={3}
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder={t('sales_notes_ph')}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setSelected(null)} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-300 text-sm hover:bg-slate-700 transition-colors">{t('close')}</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {saving ? t('saving') : t('save')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
