import Image from 'next/image';
import { Mail, ExternalLink } from 'lucide-react';

const APP = 'https://app.tinta-lab.de';
const YEAR = new Date().getFullYear();

const LINKS = {
  Платформа: [
    { label: 'Возможности',    href: '#features'     },
    { label: 'Как работает',   href: '#how-it-works'  },
    { label: 'Безопасность',   href: '#security'      },
    { label: 'Устройства',     href: '#devices'       },
  ],
  Аккаунт: [
    { label: 'Войти',          href: `${APP}/auth/login`     },
    { label: 'Регистрация',    href: `${APP}/auth/register`  },
    { label: 'Личный кабинет', href: `${APP}/dashboard/client` },
    { label: 'Оставить заявку', href: `${APP}/contact`       },
  ],
  Поддержка: [
    { label: 'Написать письмо', href: 'mailto:support@tinta-lab.de' },
  ],
};

export default function Footer() {
  return (
    <footer
      role="contentinfo"
      className="border-t border-slate-800/60 bg-slate-950"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt=""
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg"
                aria-hidden="true"
              />
              <span className="font-bold text-white text-lg">Tinta Lab</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-5">
              Managed Home Assistant Platform. Профессиональное управление
              умным домом с корпоративной безопасностью.
            </p>
            <a
              href="mailto:support@tinta-lab.de"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              aria-label="Написать в поддержку Tinta Lab"
            >
              <Mail size={14} aria-hidden="true" />
              support@tinta-lab.de
            </a>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([section, items]) => (
            <nav key={section} aria-label={section}>
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-4">
                {section}
              </h3>
              <ul className="space-y-3" role="list">
                {items.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-slate-500 hover:text-white transition-colors inline-flex items-center gap-1 group"
                    >
                      {link.label}
                      {link.href.startsWith('http') && (
                        <ExternalLink
                          size={10}
                          className="opacity-0 group-hover:opacity-50 transition-opacity"
                          aria-hidden="true"
                        />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <p>&copy; {YEAR} Tinta Lab. Все права защищены.</p>
          <p>
            Powered by{' '}
            <span className="text-slate-500">Home Assistant</span>
            {' & '}
            <span className="text-slate-500">Cloudflare</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
