'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';

// Shared chrome for every /dashboard/client/support/* page — one header +
// auth guard instead of repeating it on the home/list/new/detail pages.
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && user.role !== 'client') router.push('/auth/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/dashboard/client"
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} /> {t('client_support_back_dashboard')}
          </Link>
          <div className="flex items-center gap-4">
            <AppLanguageSwitcher />
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
