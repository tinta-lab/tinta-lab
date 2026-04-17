'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

const schema = z.object({
  firstName: z.string().min(2, 'Минимум 2 символа'),
  lastName: z.string().min(2, 'Минимум 2 символа'),
  email: z.string().email('Неверный email'),
  phone: z.string().min(6, 'Введите номер телефона'),
  city: z.string().optional(),
  password: z.string().min(8, 'Минимум 8 символов'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

const inputCls = 'w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all text-sm';
const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

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
      router.push('/dashboard/client');
    } catch (e: any) {
      const msg = e.response?.data?.message;
      if (msg === 'Email already exists' || (Array.isArray(msg) && msg.some((m: string) => m.includes('email')))) {
        toast.error('Этот email уже зарегистрирован');
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
          <img src="/logo.png" alt="Tinta Smart" className="w-24 h-24 rounded-3xl mb-4 mx-auto shadow-lg shadow-teal-500/20" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Tinta Smart</h1>
          <p className="text-slate-400 text-sm mt-1">Регистрация клиентского аккаунта</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Создать аккаунт</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Имя</label>
                <input {...register('firstName')} className={inputCls} placeholder="Макс" />
                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Фамилия</label>
                <input {...register('lastName')} className={inputCls} placeholder="Мюллер" />
                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className={labelCls}>Email</label>
              <input {...register('email')} type="email" className={inputCls} placeholder="max@example.de" />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className={labelCls}>Телефон</label>
              <input {...register('phone')} type="tel" className={inputCls} placeholder="+49 151 12345678" />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
            </div>

            {/* City (optional) */}
            <div>
              <label className={labelCls}>
                Город <span className="text-slate-500 font-normal text-xs">(необязательно)</span>
              </label>
              <input {...register('city')} className={inputCls} placeholder="Berlin" />
            </div>

            {/* Password */}
            <div>
              <label className={labelCls}>Пароль</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  className={`${inputCls} pr-10`}
                  placeholder="Минимум 8 символов"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {/* Confirm password */}
            <div>
              <label className={labelCls}>Повторите пароль</label>
              <input
                {...register('confirmPassword')}
                type={showPassword ? 'text' : 'password'}
                className={inputCls}
                placeholder="Повторите пароль"
              />
              {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

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
          Tinta Smart &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
