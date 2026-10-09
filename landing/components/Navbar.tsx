'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';

const APP = 'https://app.tinta-lab.de';

export default function Navbar() {
  const t = useTranslations('nav');
  const cta = useTranslations('cta');
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = () => setOpen(false);

  const NAV = [
    { href: '#features',     label: t('features')   },
    { href: '#how-it-works', label: t('howItWorks')  },
    { href: '#security',     label: t('security')    },
    { href: '#devices',      label: t('devices')     },
  ];

  return (
    <header
      role="banner"
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-slate-950/70 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent'
      }`}
    >
      <nav
        aria-label={t('aria')}
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16"
      >
        {/* Logo */}
        <a
          href={pathname === '/' ? '#hero' : '/'}
          onClick={close}
          className="flex items-center gap-2 group"
          aria-label={t('logoAriaLabel')}
        >
          <Image src="/logo.png" alt="" width={32} height={32} className="w-8 h-8" aria-hidden="true" />
          <Image src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-9 w-auto" priority />
        </a>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6" role="list">
          {NAV.map(n => (
            <li key={n.href}>
              <a href={n.href} className="text-sm text-slate-400 hover:text-white transition-colors">
                {n.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA — new visitors want a consultation; existing clients
            just need a way in. "Mein Konto" as the only button sent both to
            the login form. */}
        <div className="hidden md:flex items-center gap-5">
          <a href={`${APP}/auth/login`} className="text-sm text-slate-300 hover:text-white transition-colors">
            {t('login')}
          </a>
          <a href={`${APP}/contact`} className="text-sm font-semibold bg-teal-400 hover:bg-teal-300 text-slate-950 px-4 py-2 rounded-full transition-colors">
            {cta('primary')}
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? t('closeMenu') : t('openMenu')}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur-md"
          role="dialog"
          aria-label={t('mobileMenu')}
        >
          <ul className="px-4 py-4 space-y-1" role="list">
            {NAV.map(n => (
              <li key={n.href}>
                <a href={n.href} onClick={close} className="block py-2.5 text-slate-300 hover:text-white text-sm transition-colors">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="px-4 pb-5 space-y-2 border-t border-slate-800 pt-4">
            <a
              href={`${APP}/contact`}
              onClick={close}
              className="block w-full text-center py-3 rounded-full bg-teal-400 hover:bg-teal-300 text-slate-950 font-semibold text-sm transition-colors"
            >
              {cta('primary')}
            </a>
            <a
              href={`${APP}/auth/login`}
              onClick={close}
              className="block w-full text-center py-3 rounded-full border border-white/10 text-slate-200 text-sm transition-colors hover:border-white/25"
            >
              {t('login')}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
