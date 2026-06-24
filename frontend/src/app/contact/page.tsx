'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle2, Home, Headphones, TrendingUp, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { PhoneInput } from '@/components/PhoneInput';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tinta-lab.de';

const schema = z.object({
  name:    z.string().min(2, 'Минимум 2 символа').max(128),
  email:   z.string().email('Введите корректный email').max(254),
  phone:   z.string().refine(v => v.replace(/\D/g, '').length >= 7, 'Введите номер телефона'),
  type:    z.enum(['sales', 'installation', 'support', 'other']),
  subject: z.string().min(3, 'Минимум 3 символа').max(256),
  message: z.string().min(10, 'Минимум 10 символов').max(4000),
});

type FormData = z.infer<typeof schema>;

const TYPES = [
  { value: 'sales',        label: 'Хочу подключиться',     desc: 'Интересует услуга умного дома',    icon: TrendingUp,  color: 'border-teal-500/40 bg-teal-500/5 text-teal-400' },
  { value: 'installation', label: 'Установка / настройка',  desc: 'Помощь с установкой оборудования', icon: Home,        color: 'border-blue-500/40 bg-blue-500/5 text-blue-400' },
  { value: 'support',      label: 'Техническая поддержка',  desc: 'Проблема с существующей системой', icon: Headphones,  color: 'border-amber-500/40 bg-amber-500/5 text-amber-400' },
  { value: 'other',        label: 'Другое',                 desc: 'Любой другой вопрос',              icon: HelpCircle,  color: 'border-slate-500/40 bg-slate-500/5 text-slate-400' },
] as const;

const inputCls = (hasError: boolean) =>
  `w-full px-4 py-2.5 rounded-xl bg-slate-800/60 border ${
    hasError
      ? 'border-red-500 focus:border-red-400 focus:ring-red-500/30'
      : 'border-slate-600/60 focus:border-teal-500 focus:ring-teal-500/30'
  } text-white placeholder-slate-500 focus:outline-none focus:ring-1 transition-all text-sm`;

const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

export default function ContactPage() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

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
      alert('Ошибка отправки. Попробуйте позже или напишите нам напрямую.');
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
          <h2 className="text-2xl font-bold text-white mb-3">Заявка отправлена!</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Мы получили ваше сообщение и свяжемся с вами в течение рабочего дня.
          </p>
          <p className="text-slate-500 text-xs mt-6">
            Уже клиент?{' '}
            <Link href="/auth/login" className="text-teal-400 hover:text-teal-300 transition-colors">
              Войти в личный кабинет
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tinta Lab" className="w-16 h-16 rounded-2xl mb-4 mx-auto shadow-lg shadow-teal-500/20" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Tinta Lab</h1>
          <p className="text-slate-400 text-sm mt-1">Свяжитесь с нами — ответим в течение рабочего дня</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" autoComplete="off">

            {/* Request type */}
            <div>
              <p className={labelCls}>Тема запроса</p>
              <div className="grid grid-cols-2 gap-2">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  const active = selectedType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setValue('type', t.value)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${
                        active
                          ? t.color + ' border-opacity-100'
                          : 'border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:bg-slate-700/40'
                      }`}
                    >
                      <Icon size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-semibold leading-tight">{t.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5 leading-tight">{t.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className={labelCls}>Имя и фамилия</label>
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
                <label className={labelCls}>Email</label>
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="max@beispiel.de"
                  className={inputCls(!!errors.email)}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Телефон</label>
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
              <label className={labelCls}>Тема</label>
              <input
                {...register('subject')}
                type="text"
                placeholder={
                  selectedType === 'sales'        ? 'Хочу подключить умный дом' :
                  selectedType === 'installation' ? 'Нужна помощь с установкой' :
                  selectedType === 'support'      ? 'Не работает освещение' :
                  'Кратко опишите вопрос'
                }
                className={inputCls(!!errors.subject)}
              />
              {errors.subject && <p className="text-red-400 text-xs mt-1">{errors.subject.message}</p>}
            </div>

            {/* Message */}
            <div>
              <label className={labelCls}>Сообщение</label>
              <textarea
                {...register('message')}
                rows={4}
                placeholder={
                  selectedType === 'sales'        ? 'Расскажите о вашем доме, что хотите автоматизировать, когда удобно связаться…' :
                  selectedType === 'installation' ? 'Опишите ситуацию: адрес, тип оборудования, что уже установлено…' :
                  selectedType === 'support'      ? 'Опишите проблему подробно: что не работает, когда началось…' :
                  'Опишите ваш вопрос подробнее…'
                }
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
                ? <><Loader2 size={16} className="animate-spin" /> Отправляю…</>
                : 'Отправить заявку'
              }
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-5">
            Уже клиент?{' '}
            <Link href="/auth/login" className="text-slate-500 hover:text-teal-400 transition-colors">
              Войти в личный кабинет
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-700 text-xs mt-4">
          Tinta Lab &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
