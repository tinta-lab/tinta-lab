'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';

const APP = 'https://app.tinta-lab.de';

export default function Navbar() {
  const t = useTranslations('nav');
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
          ? 'bg-slate-950/90 backdrop-blur-md border-b border-slate-800/60 shadow-lg shadow-black/20'
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

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href={`${APP}/auth/login`} className="text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white px-4 py-1.5 rounded-lg transition-colors">
            {t('start')}
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
              href={`${APP}/auth/login`}
              onClick={close}
              className="block w-full text-center py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-sm transition-colors"
            >
              {t('start')}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
