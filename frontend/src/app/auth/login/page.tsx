'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

const schema = z.object({
  email: z.string().email('Неверный email'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

type FormData = z.infer<typeof schema>;

const ROLE_REDIRECT = {
  admin: '/dashboard/admin',
  support: '/dashboard/support',
  sales: '/dashboard/sales',
  client: '/dashboard/client',
};

export default function LoginPage() {
  const router = useRouter();
  const { login, user, init } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (user) {
      router.push(ROLE_REDIRECT[user.role]);
    }
  }, [user, router]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Добро пожаловать!');
      const currentUser = useAuth.getState().user;
      if (currentUser) {
        router.push(ROLE_REDIRECT[currentUser.role]);
      }
    } catch {
      toast.error('Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Tinta Smart" className="w-16 h-16 rounded-2xl mb-4 mx-auto" />
          <h1 className="text-2xl font-bold text-white tracking-tight">Tinta Smart</h1>
          <p className="text-slate-400 text-sm mt-1">Система управления умным домом</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Вход в систему</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="admin@tinta-lab.de"
                className="w-full px-4 py-2.5 rounded-lg bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all text-sm"
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Пароль
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 rounded-lg bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Вход...</>
              ) : (
                'Войти'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4">
          Новый клиент?{' '}
          <Link href="/auth/register" className="text-teal-400 hover:text-teal-300 transition-colors">
            Создать аккаунт
          </Link>
        </p>

        <p className="text-center text-slate-600 text-xs mt-4">
          Tinta Smart &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
