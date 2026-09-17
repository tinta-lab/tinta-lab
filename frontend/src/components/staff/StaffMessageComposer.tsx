'use client';
import { useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { useLocale } from '@/i18n/context';

interface StaffMessageComposerProps {
  onSend: (message: string, internal: boolean) => Promise<void>;
}

// Shared by the SUPPORT ticket detail page and the ADMIN ticket modal —
// the public/internal choice and the POST /tickets/:id/messages call shape
// (message + internal) are identical for every staff role that can reply.
export default function StaffMessageComposer({ onSend }: StaffMessageComposerProps) {
  const { t } = useLocale();
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await onSend(message.trim(), internal);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setInternal(false)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            !internal
              ? 'bg-teal-600/20 border-teal-500 text-teal-300'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
          }`}
        >
          {t('staff_reply_public_label')}
        </button>
        <button
          type="button"
          onClick={() => setInternal(true)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            internal
              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600'
          }`}
        >
          {t('staff_reply_internal_label')}
        </button>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={internal ? t('staff_reply_internal_label') : t('client_support_reply_ph')}
          maxLength={4000}
          rows={2}
          className={`flex-1 bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors resize-y ${
            internal ? 'border-amber-500/40 focus:border-amber-500' : 'border-slate-600 focus:border-teal-500'
          }`}
        />
        <button
          onClick={submit}
          disabled={sending || !message.trim()}
          className={`h-9 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50 flex-shrink-0 ${
            internal ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-teal-600 hover:bg-teal-500 text-white'
          }`}
        >
          {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          {t('client_support_reply_submit')}
        </button>
      </div>
    </div>
  );
}
