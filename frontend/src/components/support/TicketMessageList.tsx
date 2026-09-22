import { useLocale } from '@/i18n/context';
import { ClientTicketMessage } from '@/types';
import { formatDateTime } from '@/lib/format';

export default function TicketMessageList({ messages }: { messages: ClientTicketMessage[] }) {
  const { t, locale } = useLocale();

  if (messages.length === 0) {
    return <p className="text-sm text-slate-500 italic py-4">{t('client_support_no_messages')}</p>;
  }

  return (
    <div className="space-y-3 py-2">
      {messages.map((m) => {
        const isStaff = m.authorRole !== 'client';
        return (
          <div key={m.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
              isStaff
                ? 'bg-teal-600/15 border border-teal-500/20'
                : 'bg-slate-800/60 border border-slate-700/50'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium ${isStaff ? 'text-teal-400' : 'text-slate-300'}`}>
                  {isStaff ? t('client_support_staff_label') : t('client_support_you')}
                </span>
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
