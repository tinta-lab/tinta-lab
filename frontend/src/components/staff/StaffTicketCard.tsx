import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useLocale } from '@/i18n/context';
import { Ticket } from '@/types';
import TicketStatus from '@/components/support/TicketStatus';

const TYPE_LABEL_KEY = {
  installation: 'type_installation',
  support: 'type_support',
  sales: 'type_sales',
  other: 'type_other',
} as const;

export default function StaffTicketCard({ ticket }: { ticket: Ticket }) {
  const { t } = useLocale();

  return (
    <Link
      href={`/dashboard/support/tickets/${ticket.id}`}
      className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-slate-800/60 transition-colors"
    >
      <div className="min-w-0">
        <div className="font-medium text-sm text-white truncate">{ticket.subject}</div>
        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
          <span>{ticket.name}</span>
          <span className="text-slate-700">·</span>
          <span>{t(TYPE_LABEL_KEY[ticket.type])}</span>
          {ticket.server?.name && (
            <>
              <span className="text-slate-700">·</span>
              <span>{ticket.server.name}</span>
            </>
          )}
          <span className="text-slate-700">·</span>
          <span>
            {new Date(ticket.createdAt).toLocaleDateString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <TicketStatus status={ticket.status} />
        <ChevronRight size={16} className="text-slate-600" />
      </div>
    </Link>
  );
}
