'use client';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2, Home, Headphones, TrendingUp, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { PhoneInput } from '@/components/PhoneInput';
import { useLocale } from '@/i18n/context';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tinta-lab.de';

type FormData = {
  name: string;
  email: string;
  phone: string;
  type: 'sales' | 'installation' | 'support' | 'other';
  subject: string;
  message: string;
};

const inputCls = (hasError: boolean) =>
  `w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border ${
    hasError
      ? 'border-red-500 focus:border-red-400 focus:ring-red-500/30'
      : 'border-slate-600/60 focus:border-teal-500 focus:ring-teal-500/30'
  } text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-all text-sm`;

const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

export default function ContactPage() {
  const { t } = useLocale();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const schema = useMemo(() => z.object({
    name:    z.string().min(2, t('contact_val_name')).max(128),
    email:   z.string().email(t('contact_val_email')).max(254),
    phone:   z.string().refine(v => v.replace(/\D/g, '').length >= 7, t('contact_val_phone')),
    type:    z.enum(['sales', 'installation', 'support', 'other']),
    subject: z.string().min(3, t('contact_val_subject')).max(256),
    message: z.string().min(10, t('contact_val_msg')).max(4000),
  }), [t]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'sales', phone: '+49' },
  });

  const selectedType = watch('type');
  const phoneValue   = watch('phone', '+49');

  const TYPES = useMemo(() => [
    { value: 'sales' as const,        label: t('contact_type_sales'),   desc: t('contact_type_sales_desc'),   icon: TrendingUp, color: 'border-teal-500/40 bg-teal-500/5 text-teal-400' },
    { value: 'installation' as const, label: t('contact_type_install'), desc: t('contact_type_install_desc'), icon: Home,       color: 'border-blue-500/40 bg-blue-500/5 text-blue-400' },
    { value: 'support' as const,      label: t('contact_type_support'), desc: t('contact_type_support_desc'), icon: Headphones, color: 'border-amber-500/40 bg-amber-500/5 text-amber-400' },
    { value: 'other' as const,        label: t('contact_type_other'),   desc: t('contact_type_other_desc'),   icon: HelpCircle, color: 'border-slate-500/40 bg-slate-500/5 text-slate-400' },
  ], [t]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/tickets/public`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
    } catch {
      alert(t('contact_err_send'));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-teal-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">{t('contact_success_title')}</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{t('contact_success_text')}</p>
          <p className="text-slate-500 text-xs mt-6">
            {t('contact_login')}{' '}
            <Link href="/auth/login" className="text-teal-400 hover:text-teal-300 transition-colors">
              {t('login_register_link')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const subjectPh = {
    sales: t('contact_subject_ph_sales'),
    installation: t('contact_subject_ph_install'),
    support: t('contact_subject_ph_support'),
    other: t('contact_subject_ph_other'),
  };
  const messagePh = {
    sales: 'Расскажите о вашем доме…',
    installation: 'Опишите ситуацию…',
    support: 'Опишите проблему подробно…',
    other: t('contact_msg_ph'),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <a href="https://tinta-lab.de" className="inline-flex flex-col items-center gap-0">
            <img src="/logo.png" alt="Tinta Lab" className="w-16 h-16 mb-4 drop-shadow-[0_4px_16px_rgba(20,184,166,0.4)]" />
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-9 w-auto" />
          </a>
          <p className="text-slate-400 text-sm mt-1">{t('contact_subtitle')}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" autoComplete="off">

            {/* Request type */}
            <div>
              <p className={labelCls}>{t('contact_type')}</p>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(type => {
                  const Icon = type.icon;
                  const active = selectedType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setValue('type', type.value)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        active
                          ? type.color + ' border-opacity-100'
                          : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40'
                      }`}
                    >
                      <Icon size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold leading-tight">{type.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-tight">{type.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className={labelCls}>{t('contact_name')}</label>
              <input
                {...register('name')}
                type="text"
                autoComplete="name"
                placeholder="Max Müller"
                className={inputCls(!!errors.name)}
              />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('contact_email')}</label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  className={inputCls(!!errors.email)}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className={labelCls}>{t('contact_phone')}</label>
                <PhoneInput
                  value={phoneValue}
                  onChange={v => setValue('phone', v, { shouldValidate: true })}
                  hasError={!!errors.phone}
                />
                {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className={labelCls}>{t('contact_subject')}</label>
              <input
                {...register('subject')}
                type="text"
                placeholder={subjectPh[selectedType]}
                className={inputCls(!!errors.subject)}
              />
              {errors.subject && <p className="text-red-400 text-xs mt-1">{errors.subject.message}</p>}
            </div>

            {/* Message */}
            <div>
              <label className={labelCls}>{t('contact_message')}</label>
              <textarea
                {...register('message')}
                rows={4}
                placeholder={messagePh[selectedType]}
                className={`${inputCls(!!errors.message)} resize-none`}
              />
              {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message.message}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-all flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> {t('contact_submitting')}</>
                : t('contact_submit')
              }
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-5">
            {t('contact_login')}{' '}
            <Link href="/auth/login" className="text-slate-500 hover:text-teal-400 transition-colors">
              {t('login_submit')}
            </Link>
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 mt-4">
          <p className="text-slate-700 text-xs">Tinta Lab &copy; {new Date().getFullYear()}</p>
          <div className="h-3 w-px bg-slate-700" aria-hidden="true" />
          <AppLanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
