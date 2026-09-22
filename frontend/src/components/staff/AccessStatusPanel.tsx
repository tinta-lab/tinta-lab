'use client';
import { useState } from 'react';
import { Shield, KeyRound, RefreshCw, Clock } from 'lucide-react';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useLocale } from '@/i18n/context';
import { formatTime } from '@/lib/format';
import CredentialsModal, { AccessCredentials } from './CredentialsModal';

// This panel is rendered from both ADMIN (admin/tickets) and STAFF
// (support/tickets/[id]) screens, whose ticket.server is typed
// ClientServer | SupportServer (or, for ADMIN, the raw entity at runtime —
// see P1.4-C). Rather than accept either view type (which would leak each
// view's unrelated fields into this component's contract), a local type
// pins down exactly the fields actually used below — both real shapes are
// a superset of this, so both satisfy it structurally.
type AccessStatusServer = {
  id: string;
  subdomain: string;
  publicUrl?: string | null;
  accessEnabled: boolean;
  accessExpiresAt: string | null;
};

// Read-only view of a ticket's linked server's access state, with the same
// "get credentials" action as dashboard/support/page.tsx's ServerCard.
// Staff never grants access here — POST /access/grant/:serverId is
// CLIENT/ADMIN only — this only surfaces what the client already opened.
export default function AccessStatusPanel({ server }: { server: AccessStatusServer | null | undefined }) {
  const { t, locale } = useLocale();
  const [connecting, setConnecting] = useState(false);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);

  if (!server) {
    return (
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 text-sm text-slate-500">
        {t('staff_ticket_no_access')}
      </div>
    );
  }

  const connect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.post(`/access/connect/${server.id}`);
      const url = server.publicUrl ? `https://${server.publicUrl}` : `https://${server.subdomain}`;
      setCredentials({ serverId: server.id, url, password: data?.supportPassword ?? '' });
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) {
        toast.error(t('support_session_claimed'));
      } else {
        toast.error(t('support_connect_error'));
      }
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
      {credentials && <CredentialsModal creds={credentials} onClose={() => setCredentials(null)} />}
      <div className="flex items-center gap-2 mb-1">
        <Shield size={15} className={server.accessEnabled ? 'text-green-400' : 'text-slate-500'} />
        <span className="text-sm font-medium">{t('staff_ticket_access_title')}</span>
      </div>
      {server.accessEnabled ? (
        <>
          <div className="flex items-center gap-2 text-xs text-green-400 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            {t('support_access_open')}
            {server.accessExpiresAt && (
              <span className="flex items-center gap-1 text-slate-500">
                <Clock size={11} />
                {formatTime(server.accessExpiresAt, locale, { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <button
            onClick={connect}
            disabled={connecting}
            className="w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 disabled:opacity-50"
          >
            {connecting ? <RefreshCw size={14} className="animate-spin" /> : <><KeyRound size={14} /> {t('support_get_access')}</>}
          </button>
        </>
      ) : (
        <p className="text-xs text-slate-500">{t('support_no_active')}</p>
      )}
    </div>
  );
}
