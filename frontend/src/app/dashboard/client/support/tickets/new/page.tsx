'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useLocale } from '@/i18n/context';
import api from '@/lib/api';
import { supportApi } from '@/services/supportApi';
import { ClientServer, TicketType } from '@/types';
import type { TranslationKey } from '@/i18n/translations';

const TYPE_OPTIONS: { value: TicketType; labelKey: TranslationKey }[] = [
  { value: 'support', labelKey: 'client_support_type_support' },
  { value: 'installation', labelKey: 'client_support_type_installation' },
  { value: 'sales', labelKey: 'client_support_type_sales' },
  { value: 'other', labelKey: 'client_support_type_other' },
];

export default function NewTicketPage() {
  const router = useRouter();
  const { t } = useLocale();

  const [servers, setServers] = useState<ClientServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(true);

  const [type, setType] = useState<TicketType>('support');
  const [subject, setSubject] = useState('');
  const [subjectTouched, setSubjectTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [serverId, setServerId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get<ClientServer[]>('/servers/my').then(({ data }) => {
      setServers(data);
      if (data.length === 1) setServerId(data[0].id);
    }).finally(() => setLoadingServers(false));
  }, []);

  // Subject defaults to the selected type's label until the user edits it
  // by hand — keeps the "Create request" form to one required decision
  // (what kind of problem) instead of two, while still letting anyone who
  // wants a more specific subject line write their own.
  useEffect(() => {
    if (!subjectTouched) {
      setSubject(t(TYPE_OPTIONS.find((o) => o.value === type)!.labelKey));
    }
  }, [type, subjectTouched, t]);

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!subject.trim()) errs.subject = t('client_support_val_subject');
    if (description.trim().length < 10) errs.description = t('client_support_val_description');
    if (!serverId) errs.serverId = t('client_support_val_home');
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const ticket = await supportApi.createTicket({
        type,
        subject: subject.trim(),
        description: description.trim(),
        serverId,
      });
      toast.success(t('client_support_created_toast'));
      router.push(`/dashboard/client/support/tickets/${ticket.id}`);
    } catch {
      toast.error(t('client_support_create_error'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (err?: string) =>
    `w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
      err ? 'border-red-500' : 'border-slate-600 focus:border-teal-500'
    }`;

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-bold">{t('client_support_new_title')}</h1>

      <div className="space-y-2">
        {TYPE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
              type === opt.value
                ? 'border-teal-500 bg-teal-600/10'
                : 'border-slate-700 bg-slate-800/40 hover:border-slate-600'
            }`}
          >
            <input
              type="radio"
              name="type"
              checked={type === opt.value}
              onChange={() => setType(opt.value)}
              className="accent-teal-500"
            />
            <span className="text-sm text-white">{t(opt.labelKey)}</span>
          </label>
        ))}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">{t('client_support_subject_label')}</label>
        <input
          className={inputCls(errors.subject)}
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setSubjectTouched(true); }}
          maxLength={256}
        />
        {errors.subject && <p className="text-red-400 text-xs mt-1">{errors.subject}</p>}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">{t('client_support_describe_label')}</label>
        <textarea
          className={`${inputCls(errors.description)} min-h-28 resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('client_support_describe_ph')}
          maxLength={4000}
        />
        {errors.description && <p className="text-red-400 text-xs mt-1">{errors.description}</p>}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">{t('client_support_home_label')}</label>
        {loadingServers ? (
          <div className="h-9 bg-slate-800/60 rounded-lg animate-pulse" />
        ) : servers.length === 0 ? (
          <p className="text-sm text-amber-400">{t('client_support_no_home')}</p>
        ) : (
          <select
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            className={inputCls(errors.serverId).replace('placeholder-slate-500', '')}
          >
            <option value="">{t('client_support_select_home')}</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
        {errors.serverId && <p className="text-red-400 text-xs mt-1">{errors.serverId}</p>}
      </div>

      <div className="flex gap-3">
        <button
          onClick={submit}
          disabled={submitting || loadingServers || servers.length === 0}
          className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white transition-all disabled:opacity-50"
        >
          {submitting ? t('client_support_submitting') : t('client_support_submit')}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/client/support')}
          disabled={submitting}
          className="px-5 py-2.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors disabled:opacity-50"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}
