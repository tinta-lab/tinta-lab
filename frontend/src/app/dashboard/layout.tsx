'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// One guard for every /dashboard route. Pages render `if (!user) return null`
// until useAuth.init() has read the stored profile; with no stored profile
// (logged out, other browser, cleared storage) that null was permanent — no
// API request was ever made, so the 401 → /auth/login redirect in lib/api.ts
// never fired and the visitor got a blank screen. A stale profile with an
// expired cookie is still handled by that 401 interceptor on the first call.
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}
function hasStoredUser(): boolean {
  try { return !!localStorage.getItem('user'); } catch { return false; }
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // null on the server / first hydration pass, then the real answer
  const signedIn = useSyncExternalStore(subscribe, hasStoredUser, () => null);

  useEffect(() => {
    if (signedIn === false) router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
  }, [signedIn, pathname, router]);

  if (!signedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 size={22} className="animate-spin text-teal-400" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}
