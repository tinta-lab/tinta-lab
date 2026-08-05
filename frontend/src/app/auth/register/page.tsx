'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { PhoneInput } from '@/components/PhoneInput';

const schema = z.object({
  firstName: z.string().min(2, 'Минимум 2 символа').max(64),
  lastName: z.string().min(2, 'Минимум 2 символа').max(64),
  email: z.string().email('Введите корректный email').max(254),
  phone: z.string().refine(v => v.replace(/\D/g, '').length >= 7, 'Введите корректный номер телефона'),
  city: z.string().max(128).optional(),
  password: z.string()
    .min(8, 'Минимум 8 символов')
    .max(128),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

function passwordScore(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

const strengthMeta = [
  { label: 'Слабый',   bar: 'w-1/4',  color: 'bg-red-500',    text: 'text-red-400'    },
  { label: 'Средний',  bar: 'w-2/4',  color: 'bg-yellow-500', text: 'text-yellow-400' },
  { label: 'Хороший',  bar: 'w-3/4',  color: 'bg-blue-500',   text: 'text-blue-400'   },
  { label: 'Сильный',  bar: 'w-full', color: 'bg-green-500',  text: 'text-green-400'  },
];

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score = passwordScore(value);
  const idx = Math.min(Math.floor((score / 5) * 4), 3);
  const meta = strengthMeta[idx];
  return (
    <div className="mt-2">
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${meta.color} ${meta.bar}`} />
      </div>
      <p className={`text-xs mt-1 ${meta.text}`}>{meta.label}</p>
    </div>
  );
}

const inputCls = (hasError: boolean) =>
  `w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border ${
    hasError ? 'border-red-500 focus:border-red-400' : 'border-slate-600 focus:border-teal-500'
  } text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${
    hasError ? 'focus:ring-red-500/30' : 'focus:ring-teal-500/50'
  } transition-all text-sm`;

const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

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
      toast.success('Аккаунт создан! Добро пожаловать.');
      window.location.href = '/dashboard/client';
    } catch (e: any) {
      const msg = e.response?.data?.message;
      if (msg === 'Email already exists' || (Array.isArray(msg) && msg.some((m: string) => m.includes('email')))) {
        toast.error('Этот email уже зарегистрирован');
      } else if (e.response?.status === 429) {
        toast.error('Слишком много попыток. Повторите позже.');
      } else {
        toast.error('Ошибка регистрации. Попробуйте снова.');
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
          <img src="/logo.png" alt="Tinta Lab" className="w-24 h-24 mb-4 mx-auto drop-shadow-[0_4px_20px_rgba(20,184,166,0.45)]" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Tinta Lab</h1>
          <p className="text-slate-400 text-sm mt-1">Регистрация клиентского аккаунта</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Создать аккаунт</h2>

          {/* autoComplete="off" on form prevents browser from suggesting saved login credentials */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Имя</label>
                <input
                  {...register('firstName')}
                  autoComplete="given-name"
                  className={inputCls(!!errors.firstName)}
                  placeholder="Макс"
                />
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Фамилия</label>
                <input
                  {...register('lastName')}
                  autoComplete="family-name"
                  className={inputCls(!!errors.lastName)}
                  placeholder="Мюллер"
                />
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>Email</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="off"
                inputMode="email"
                className={inputCls(!!errors.email)}
                placeholder="max@beispiel.de"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>Телефон</label>
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
                Город <span className="text-slate-500 font-normal text-xs">(необязательно)</span>
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
              <label className={labelCls}>Пароль</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${inputCls(!!errors.password)} pr-10`}
                  placeholder="Минимум 8 символов"
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
              <PasswordStrength value={passwordValue} />
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className={labelCls}>Повторите пароль</label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  className={`${inputCls(!!errors.confirmPassword)} pr-10`}
                  placeholder="Повторите пароль"
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
                Минимум 8 символов
              </li>
              <li className={`flex items-center gap-1.5 ${/[A-Z]/.test(passwordValue) ? 'text-green-400' : ''}`}>
                <CheckCircle2 size={11} className={/[A-Z]/.test(passwordValue) ? 'text-green-400' : 'text-slate-600'} />
                Хотя бы одна заглавная буква
              </li>
              <li className={`flex items-center gap-1.5 ${/[0-9]/.test(passwordValue) ? 'text-green-400' : ''}`}>
                <CheckCircle2 size={11} className={/[0-9]/.test(passwordValue) ? 'text-green-400' : 'text-slate-600'} />
                Хотя бы одна цифра
              </li>
            </ul>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Регистрация...</>
              ) : (
                'Создать аккаунт'
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-5">
            Уже есть аккаунт?{' '}
            <Link href="/auth/login" className="text-teal-400 hover:text-teal-300 transition-colors">
              Войти
            </Link>
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Tinta Lab &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
