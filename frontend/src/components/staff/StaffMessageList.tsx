import { useLocale } from '@/i18n/context';
import type { TranslationKey } from '@/i18n/translations';
import { StaffTicketMessage } from '@/types';
import { formatDateTime } from '@/lib/format';

// Falls back to this whenever a message's `author` relation is null (e.g. a
// deactivated user) — never render the raw `authorRole` enum ('support' /
// 'sales' / 'client') directly, that's a backend value, not UI text.
const ROLE_LABEL_KEY: Record<StaffTicketMessage['authorRole'], TranslationKey> = {
  admin: 'role_admin',
  support: 'role_support',
  sales: 'role_sales',
  client: 'role_client',
};

// Staff-facing conversation — unlike the client's TicketMessageList, this
// shows internal notes too (visually flagged), since GET /tickets/:id/messages
// (staff role) returns the full thread rather than the client-visible subset.
export default function StaffMessageList({ messages }: { messages: StaffTicketMessage[] }) {
  const { t, locale } = useLocale();

  if (messages.length === 0) {
    return <p className="text-sm text-slate-500 italic py-4">{t('client_support_no_messages')}</p>;
  }

  return (
    <div className="space-y-3 py-2">
      {messages.map((m) => {
        const isClient = m.authorRole === 'client';
        return (
          <div key={m.id} className={`flex ${isClient ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 border ${
                m.internal
                  ? 'bg-amber-500/10 border-amber-500/30 border-dashed'
                  : isClient
                    ? 'bg-slate-800/60 border-slate-700/50'
                    : 'bg-teal-600/15 border-teal-500/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium ${isClient ? 'text-slate-300' : 'text-teal-400'}`}>
                  {isClient
                    ? t('staff_ticket_client_label')
                    : m.author
                      ? `${m.author.firstName} ${m.author.lastName}`
                      : t(ROLE_LABEL_KEY[m.authorRole])}
                </span>
                {m.internal && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {t('staff_internal_badge')}
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {formatDateTime(m.createdAt, locale, {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{m.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
