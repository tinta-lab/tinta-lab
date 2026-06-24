'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';

const APP = 'https://app.tinta-lab.de';

const NAV = [
  { href: '#features',     label: 'Возможности'   },
  { href: '#how-it-works', label: 'Как работает'   },
  { href: '#security',     label: 'Безопасность'   },
  { href: '#devices',      label: 'Устройства'     },
];

export default function Navbar() {
  const [open,     setOpen]     = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const close = () => setOpen(false);

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
        aria-label="Главная навигация"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16"
      >
        {/* Logo */}
        <Link
          href="#hero"
          onClick={close}
          className="flex items-center gap-2 group"
          aria-label="Tinta Lab — на главную"
        >
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-lg"
            aria-hidden="true"
          />
          <span className="font-bold text-white text-lg tracking-tight">Tinta Lab</span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-6" role="list">
          {NAV.map(n => (
            <li key={n.href}>
              <a
                href={n.href}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                {n.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href={`${APP}/auth/login`}
            className="text-sm text-slate-300 hover:text-white transition-colors px-3 py-1.5"
          >
            Войти
          </a>
          <a
            href={`${APP}/auth/register`}
            className="text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg transition-colors"
          >
            Начать
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
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
          aria-label="Мобильное меню"
        >
          <ul className="px-4 py-4 space-y-1" role="list">
            {NAV.map(n => (
              <li key={n.href}>
                <a
                  href={n.href}
                  onClick={close}
                  className="block py-2.5 text-slate-300 hover:text-white text-sm transition-colors"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="px-4 pb-5 space-y-2 border-t border-slate-800 pt-4">
            <a
              href={`${APP}/auth/login`}
              onClick={close}
              className="block w-full text-center py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 text-sm transition-colors"
            >
              Войти
            </a>
            <a
              href={`${APP}/auth/register`}
              onClick={close}
              className="block w-full text-center py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
            >
              Начать бесплатно
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
