'use client';
import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import Link from 'next/link';
import { PhoneInput } from '@/components/PhoneInput';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  password: string;
  confirmPassword: string;
};

function passwordScore(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

const inputCls = (hasError: boolean) =>
  `w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border ${
    hasError ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-teal-500'
  } text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
    hasError ? 'focus:ring-red-500/30' : 'focus:ring-teal-500/50'
  } transition-all text-sm`;

const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

function PasswordStrength({ value, labels }: { value: string; labels: [string, string, string, string] }) {
  if (!value) return null;
  const score = passwordScore(value);
  const idx = Math.min(Math.floor((score / 5) * 4), 3);
  const meta = [
    { label: labels[0], bar: 'w-1/4',  color: 'bg-red-500',    text: 'text-red-400'    },
    { label: labels[1], bar: 'w-2/4',  color: 'bg-yellow-500', text: 'text-yellow-400' },
    { label: labels[2], bar: 'w-3/4',  color: 'bg-blue-500',   text: 'text-blue-400'   },
    { label: labels[3], bar: 'w-full', color: 'bg-green-500',  text: 'text-green-400'  },
  ][idx];
  return (
    <div className="mt-2">
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${meta.color} ${meta.bar}`} />
      </div>
      <p className={`text-xs mt-1 ${meta.text}`}>{meta.label}</p>
    </div>
  );
}

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const { t } = useLocale();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const schema = useMemo(() => z.object({
    firstName: z.string().min(2, t('reg_val_min2')).max(64),
    lastName: z.string().min(2, t('reg_val_min2')).max(64),
    email: z.string().email(t('reg_val_email')).max(254),
    phone: z.string().refine(v => v.replace(/\D/g, '').length >= 7, t('reg_val_phone')),
    city: z.string().max(128).optional(),
    password: z.string().min(8, t('reg_val_pass8')).max(128),
    confirmPassword: z.string(),
  }).refine(d => d.password === d.confirmPassword, {
    message: t('reg_val_match'),
    path: ['confirmPassword'],
  }), [t]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { phone: '+49' } });

  const passwordValue = watch('password', '');
  const phoneValue = watch('phone', '+49');

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await registerUser({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        city: data.city,
        password: data.password,
      });
      toast.success(t('reg_success'));
      window.location.href = '/dashboard/client';
    } catch (e: any) {
      const msg = e.response?.data?.message;
      if (msg === 'Email already exists' || (Array.isArray(msg) && msg.some((m: string) => m.includes('email')))) {
        toast.error(t('reg_err_email_exists'));
      } else if (e.response?.status === 429) {
        toast.error(t('reg_err_ratelimit'));
      } else {
        toast.error(t('reg_err_generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <a href="https://tinta-lab.de" className="inline-flex flex-col items-center gap-0">
            <img src="/logo.png" alt="Tinta Lab" className="w-24 h-24 mb-4 drop-shadow-[0_4px_20px_rgba(20,184,166,0.45)]" />
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-9 w-auto" />
          </a>
          <p className="text-slate-400 text-sm mt-1">{t('reg_subtitle')}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">{t('reg_title')}</h2>

          {/* autoComplete="off" on form prevents browser from suggesting saved login credentials */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{t('reg_firstname')}</label>
                <input
                  {...register('firstName')}
                  autoComplete="given-name"
                  className={inputCls(!!errors.firstName)}
                />
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className={labelCls}>{t('reg_lastname')}</label>
                <input
                  {...register('lastName')}
                  autoComplete="family-name"
                  className={inputCls(!!errors.lastName)}
                />
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>{t('reg_email')}</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="off"
                inputMode="email"
                className={inputCls(!!errors.email)}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>{t('reg_phone')}</label>
              <PhoneInput
                value={phoneValue}
                onChange={v => setValue('phone', v, { shouldValidate: true })}
                hasError={!!errors.phone}
              />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
            </div>

            {/* City */}
            <div>
              <label className={labelCls}>
                {t('reg_city')} <span className="text-slate-500 font-normal text-xs">{t('reg_city_optional')}</span>
              </label>
              <input
                {...register('city')}
                autoComplete="off"
                className={inputCls(false)}
                placeholder="Berlin"
              />
            </div>

            {/* Password */}
            <div>
              <label className={labelCls}>{t('reg_password')}</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${inputCls(!!errors.password)} pr-10`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <PasswordStrength value={passwordValue} labels={[t('pw_weak'), t('pw_medium'), t('pw_good'), t('pw_strong')]} />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className={labelCls}>{t('reg_confirm')}</label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${inputCls(!!errors.confirmPassword)} pr-10`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Password hints */}
            <ul className="text-xs text-slate-500 space-y-0.5 pt-1">
              <li className={`flex items-center gap-1.5 ${passwordValue.length >= 8 ? 'text-green-400' : ''}`}>
                <CheckCircle2 size={11} className={passwordValue.length >= 8 ? 'text-green-400' : 'text-slate-600'} />
                {t('reg_hint_length')}
              </li>
              <li className={`flex items-center gap-1.5 ${/[A-Z]/.test(passwordValue) ? 'text-green-400' : ''}`}>
                <CheckCircle2 size={11} className={/[A-Z]/.test(passwordValue) ? 'text-green-400' : 'text-slate-600'} />
                {t('reg_hint_upper')}
              </li>
              <li className={`flex items-center gap-1.5 ${/[0-9]/.test(passwordValue) ? 'text-green-400' : ''}`}>
                <CheckCircle2 size={11} className={/[0-9]/.test(passwordValue) ? 'text-green-400' : 'text-slate-600'} />
                {t('reg_hint_digit')}
              </li>
            </ul>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> {t('reg_submitting')}</>
              ) : (
                t('reg_submit')
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-5">
            {t('reg_has_account')}{' '}
            <Link href="/auth/login" className="text-teal-400 hover:text-teal-300 transition-colors">
              {t('reg_login_link')}
            </Link>
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          <p className="text-slate-600 text-xs">Tinta Lab &copy; {new Date().getFullYear()}</p>
          <div className="h-3 w-px bg-slate-700" aria-hidden="true" />
          <AppLanguageSwitcher />
        </div>
      </div>
    </div>
  );
}
