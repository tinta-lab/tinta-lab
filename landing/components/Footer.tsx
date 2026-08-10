import Image from 'next/image';
import { Mail, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';

const APP = 'https://app.tinta-lab.de';
const YEAR = new Date().getFullYear();

export default function Footer() {
  const t = useTranslations('footer');
  const l = useTranslations('footer.links');

  const LINKS: Record<string, Array<{ label: string; href: string }>> = {
    [t('sections.platform')]: [
      { label: l('features'),   href: '#features'    },
      { label: l('howItWorks'), href: '#how-it-works' },
      { label: l('security'),   href: '#security'     },
      { label: l('devices'),    href: '#devices'      },
      { label: l('faq'),        href: '#faq'          },
    ],
    [t('sections.account')]: [
      { label: l('login'),     href: `${APP}/auth/login`       },
      { label: l('dashboard'), href: `${APP}/dashboard/client` },
      { label: l('contact'),   href: `${APP}/contact`          },
    ],
    [t('sections.legal')]: [
      { label: l('impressum'), href: '/impressum'   },
      { label: l('privacy'),   href: '/datenschutz' },
      { label: l('terms'),     href: '/agb'         },
    ],
  };

  return (
    <footer role="contentinfo" className="border-t border-slate-800/60 bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image src="/logo.png" alt="" width={32} height={32} className="w-8 h-8" aria-hidden="true" />
              <Image src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-8 w-auto" />
            </div>
            <p className="text-sm text-slate-500 leading-relaxed mb-5">{t('desc')}</p>
            <a
              href="mailto:support@tinta-lab.de"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              aria-label="support@tinta-lab.de"
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

        <div className="mt-12 pt-6 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
          <p>&copy; {YEAR} {t('copyright')}</p>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <a href="/impressum"   className="hover:text-slate-400 transition-colors">{l('impressum')}</a>
            <a href="/datenschutz" className="hover:text-slate-400 transition-colors">{l('privacy')}</a>
            <a href="/agb"         className="hover:text-slate-400 transition-colors">{l('terms')}</a>
            <div className="h-3 w-px bg-slate-800 hidden sm:block" aria-hidden="true" />
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
