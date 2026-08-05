'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { toast } from 'sonner';
import { LogOut, RefreshCw, X, Phone, Mail, Calendar, MessageSquare, TrendingUp, Users, CheckCircle2, Clock } from 'lucide-react';
import { Ticket } from '@/types';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

const STATUS_COLORS: Record<Ticket['status'], { col: string; badge: string; header: string }> = {
  new:            { col: 'border-blue-500/30',   badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',     header: 'text-blue-400' },
  in_progress:    { col: 'border-amber-500/30',  badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', header: 'text-amber-400' },
  waiting_client: { col: 'border-purple-500/30', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30', header: 'text-purple-400' },
  resolved:       { col: 'border-green-500/30',  badge: 'bg-green-500/15 text-green-400 border-green-500/30',  header: 'text-green-400' },
  closed:         { col: 'border-slate-700',     badge: 'bg-slate-700/50 text-slate-500 border-slate-600',     header: 'text-slate-500' },
};

const COLUMNS: Ticket['status'][] = ['new', 'in_progress', 'waiting_client', 'resolved', 'closed'];
const NEXT_STATUS: Partial<Record<Ticket['status'], Ticket['status']>> = {
  new: 'in_progress',
  in_progress: 'waiting_client',
  waiting_client: 'resolved',
  resolved: 'closed',
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
          <h2 className="font-semibold text-sm leading-tight pr-4">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white flex-shrink-0"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

type TypeFilter = 'all' | 'sales' | 'installation' | 'support';

export default function SalesDashboard() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [editStatus, setEditStatus] = useState<Ticket['status']>('new');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('sales');

  const STATUS_LABELS: Record<Ticket['status'], string> = {
    new: t('status_new'),
    in_progress: t('status_in_progress'),
    waiting_client: t('status_waiting_client'),
    resolved: t('status_resolved'),
    closed: t('status_closed'),
  };

  const TYPE_LABELS: Record<Ticket['type'], string> = {
    installation: t('type_installation'),
    support: t('type_support'),
    sales: t('type_sales'),
    other: t('type_other'),
  };

  const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
    { value: 'all',          label: t('filter_all') },
    { value: 'sales',        label: t('filter_leads') },
    { value: 'installation', label: t('filter_installation') },
    { value: 'support',      label: t('filter_support') },
  ];

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'sales' && user.role !== 'admin') router.push('/auth/login');
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
    } catch { toast.error(t('sales_save_err')); }
    finally { setSaving(false); }
  };

  const quickAdvance = async (ticket: Ticket, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = NEXT_STATUS[ticket.status];
    if (!next) return;
    try {
      await api.patch(`/tickets/${ticket.id}/status`, { status: next });
      toast.success(`→ ${STATUS_LABELS[next]}`);
      await load();
    } catch { toast.error(t('sales_status_err')); }
  };

  if (!user) return null;

  const filtered = typeFilter === 'all' ? tickets : tickets.filter(ticket => ticket.type === typeFilter);
  const byStatus = (status: Ticket['status']) => filtered.filter(ticket => ticket.status === status);

  const stats = [
    { label: t('sales_new_leads'),    value: tickets.filter(ticket => ticket.type === 'sales' && ticket.status === 'new').length,        icon: TrendingUp,   color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: t('sales_in_progress'),  value: tickets.filter(ticket => ticket.status === 'in_progress').length,                           icon: Clock,        color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    { label: t('sales_installations'),value: tickets.filter(ticket => ticket.type === 'installation').length,                            icon: Users,        color: 'text-teal-400',  bg: 'bg-teal-500/10 border-teal-500/20' },
    { label: t('sales_closed'),       value: tickets.filter(ticket => ticket.status === 'resolved' || ticket.status === 'closed').length, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 flex-shrink-0">
        <div className="max-w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="https://tinta-lab.de">
              <img src="/logo.png" alt="Tinta Lab" className="w-8 h-8" />
            </a>
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-7 w-auto" />
            <span className="text-slate-500 text-sm">/ Sales</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">{tickets.filter(ticket => ticket.status === 'new').length} {t('sales_new_tickets')}</span>
            <button onClick={load} className="text-slate-400 hover:text-white transition-colors">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <AppLanguageSwitcher />
            <span className="text-sm text-slate-400">{user.firstName} {user.lastName}</span>
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      {/* Stats row */}
      <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-900/30">
        <div className="flex gap-3 flex-wrap">
          {stats.map(s => (
            <div key={s.label} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${s.bg} min-w-[140px]`}>
              <s.icon size={16} className={s.color} />
              <div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Type filter tabs */}
      <div className="px-6 pt-4 pb-1 flex gap-2 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              typeFilter === f.value
                ? 'bg-teal-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {f.label}
            <span className={`ml-1.5 text-xs ${typeFilter === f.value ? 'text-teal-200' : 'text-slate-500'}`}>
              {f.value === 'all' ? tickets.length : tickets.filter(ticket => ticket.type === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto px-6 py-4">
        <div className="flex gap-4 min-w-max h-full">
          {COLUMNS.map(status => {
            const cols = STATUS_COLORS[status];
            const items = byStatus(status);
            return (
              <div key={status} className="w-72 flex flex-col">
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className={`text-sm font-semibold ${cols.header}`}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-slate-600 bg-slate-800 border border-slate-700 rounded-full px-2 py-0.5">
                    {items.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-3">
                  {loading ? (
                    <div className="h-24 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-pulse" />
                  ) : items.length === 0 ? (
                    <div className="h-16 rounded-xl border border-dashed border-slate-700/50 flex items-center justify-center text-slate-600 text-xs">
                      {t('sales_empty')}
                    </div>
                  ) : items.map(ticket => (
                    <div
                      key={ticket.id}
                      onClick={() => openTicket(ticket)}
                      className={`bg-slate-800/70 border ${cols.col} rounded-xl p-4 cursor-pointer hover:bg-slate-800 transition-all group`}
                    >
                      <div className="font-medium text-sm leading-tight mb-2 line-clamp-2">{ticket.subject}</div>
                      <div className="text-xs text-slate-500 mb-3">{ticket.name}</div>

                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span className="bg-slate-700/60 rounded px-1.5 py-0.5">{TYPE_LABELS[ticket.type]}</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={9} />
                          {new Date(ticket.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>

                      {ticket.internalNotes && (
                        <div className="mt-2 flex items-start gap-1 text-xs text-slate-500">
                          <MessageSquare size={10} className="mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{ticket.internalNotes}</span>
                        </div>
                      )}

                      {/* Quick advance button */}
                      {NEXT_STATUS[ticket.status] && (
                        <button
                          onClick={(e) => quickAdvance(ticket, e)}
                          className="mt-3 w-full text-xs py-1.5 rounded-lg border border-slate-600 text-slate-400 hover:border-teal-500/50 hover:text-teal-400 transition-all opacity-0 group-hover:opacity-100"
                        >
                          → {STATUS_LABELS[NEXT_STATUS[ticket.status]!]}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ticket detail modal */}
      {selected && (
        <Modal title={selected.subject} onClose={() => setSelected(null)}>
          <div className="space-y-5">
            {/* Contact */}
            <div className="bg-slate-900/50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="font-medium">{selected.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[selected.status].badge}`}>
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Mail size={12} />
                <a href={`mailto:${selected.email}`} className="hover:text-white transition-colors">{selected.email}</a>
              </div>
              {selected.phone && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone size={12} />
                  <a href={`tel:${selected.phone}`} className="hover:text-white transition-colors">{selected.phone}</a>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <Calendar size={11} />
                {new Date(selected.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                <span className="text-slate-600">·</span>
                {TYPE_LABELS[selected.type]}
              </div>
            </div>

            {/* Message */}
            <div>
              <div className="text-xs text-slate-400 mb-2">{t('sales_message')}</div>
              <p className="text-sm text-slate-300 bg-slate-900/50 rounded-xl p-4 whitespace-pre-wrap">{selected.message}</p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">{t('sales_status')}</label>
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

            {/* Notes */}
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
