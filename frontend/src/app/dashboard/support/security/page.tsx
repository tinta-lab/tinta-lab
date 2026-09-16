'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useLocale } from '@/i18n/context';
import { ArrowLeft, LogOut } from 'lucide-react';
import AppLanguageSwitcher from '@/components/AppLanguageSwitcher';
import AccessLogList from '@/components/access/AccessLogList';
import { canViewSecurityCenter } from '@/lib/permissions';

// SUPPORT/SALES-facing Security Center — same event/session browser as the
// ADMIN page, but no staff filter, no raw metadata, no Chain Integrity panel
// (that's an ADMIN-only affordance, see admin/access-logs/page.tsx). The
// backend already scopes GET /access/logs and GET /access/sessions/:id to
// tickets this staff member participated on — nothing extra to enforce here
// beyond the route guard.
export default function SupportSecurityCenterPage() {
  const router = useRouter();
  const { user, logout, init } = useAuth();
  const { t } = useLocale();

  useEffect(() => { init(); }, [init]);
  useEffect(() => {
    if (user && !canViewSecurityCenter(user.role)) router.push('/auth/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700/50 bg-slate-800/50 backdrop-blur px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard/support')}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={16} /> {t('support_title')}
          </button>
          <div className="flex items-center gap-4">
            <AppLanguageSwitcher />
            <button onClick={() => logout()} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
              <LogOut size={15} /> {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{t('security_center_title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('security_center_subtitle')}</p>
        </div>

        <AccessLogList showStaffFilter={false} showRawMetadata={false} />
      </main>
    </div>
  );
}
