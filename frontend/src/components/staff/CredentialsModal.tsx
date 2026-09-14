'use client';
import { useState } from 'react';
import { KeyRound, X, Copy, Check, ExternalLink } from 'lucide-react';
import { useLocale } from '@/i18n/context';

export interface AccessCredentials {
  serverId: string;
  url: string;
  password: string;
}

// Extracted from dashboard/support/page.tsx so the ticket detail view's
// AccessStatusPanel can show the exact same credentials flow instead of a
// second implementation.
export default function CredentialsModal({ creds, onClose }: { creds: AccessCredentials; onClose: () => void }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState<'url' | 'pass' | null>(null);

  const copy = (text: string, field: 'url' | 'pass') => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const openHA = () => {
    window.open(creds.url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-amber-400" />
            <span className="font-semibold">{t('support_creds_title')}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-5">
          {t('support_creds_desc').replace('tinta-support', '')}
          <span className="font-mono text-white">tinta-support</span>
          {' '}{t('support_creds_desc').split('tinta-support')[1]}
        </p>
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">{t('support_creds_url')}</div>
              <div className="font-mono text-sm text-white">{creds.url}</div>
            </div>
            <button onClick={() => copy(creds.url, 'url')} className="text-slate-400 hover:text-white ml-3 flex-shrink-0">
              {copied === 'url' ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
            </button>
          </div>
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">{t('support_creds_pass')}</div>
              <div className="font-mono text-sm text-white tracking-wider">{creds.password}</div>
            </div>
            <button onClick={() => copy(creds.password, 'pass')} className="text-slate-400 hover:text-white ml-3 flex-shrink-0">
              {copied === 'pass' ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
        <button
          onClick={openHA}
          className="w-full py-2.5 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 font-medium flex items-center justify-center gap-2 transition-all"
        >
          <ExternalLink size={15} /> {t('support_open_ha')}
        </button>
      </div>
    </div>
  );
}
