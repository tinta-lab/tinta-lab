'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const COUNTRIES = [
  { code: 'DE', dial: '+49',  flag: '🇩🇪', name: 'Deutschland',    placeholder: '151 12345678' },
  { code: 'AT', dial: '+43',  flag: '🇦🇹', name: 'Österreich',     placeholder: '664 1234567'  },
  { code: 'CH', dial: '+41',  flag: '🇨🇭', name: 'Schweiz',        placeholder: '79 123 45 67' },
  { code: 'RU', dial: '+7',   flag: '🇷🇺', name: 'Россия',         placeholder: '916 123 45 67'},
  { code: 'UA', dial: '+380', flag: '🇺🇦', name: 'Україна',        placeholder: '67 123 45 67' },
  { code: 'PL', dial: '+48',  flag: '🇵🇱', name: 'Polska',         placeholder: '501 234 567'  },
  { code: 'FR', dial: '+33',  flag: '🇫🇷', name: 'France',         placeholder: '6 12 34 56 78'},
  { code: 'GB', dial: '+44',  flag: '🇬🇧', name: 'United Kingdom', placeholder: '7911 123456'  },
  { code: 'NL', dial: '+31',  flag: '🇳🇱', name: 'Nederland',      placeholder: '6 12345678'   },
  { code: 'IT', dial: '+39',  flag: '🇮🇹', name: 'Italia',         placeholder: '312 345 6789' },
  { code: 'ES', dial: '+34',  flag: '🇪🇸', name: 'España',         placeholder: '612 345 678'  },
  { code: 'BE', dial: '+32',  flag: '🇧🇪', name: 'België',         placeholder: '470 123456'   },
] as const;

type Country = typeof COUNTRIES[number];

function detectCountry(value: string): Country {
  // Match longest dial code first (e.g. +380 before +38)
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (value.startsWith(c.dial)) return c;
  }
  return COUNTRIES[0];
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  size?: 'sm' | 'md';
}

export function PhoneInput({ value, onChange, hasError, size = 'md' }: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const country = detectCountry(value);
  const numberPart = value.startsWith(country.dial)
    ? value.slice(country.dial.length).replace(/^\s+/, '')
    : value;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCountry = (c: Country) => {
    setOpen(false);
    onChange(numberPart ? `${c.dial} ${numberPart}` : c.dial);
  };

  const handleNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value.replace(/[^\d\s\-().]/g, '');
    onChange(num ? `${country.dial} ${num}` : country.dial);
  };

  const py  = size === 'sm' ? 'py-2'   : 'py-2.5';
  const txt = size === 'sm' ? 'text-xs' : 'text-sm';
  const border = hasError ? 'border-red-500' : 'border-slate-600';
  const focusBorder = hasError ? 'focus:border-red-400 focus:ring-red-500/30' : 'focus:border-teal-500 focus:ring-teal-500/50';

  return (
    <div ref={ref} className="relative flex">
      {/* Country selector button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-3 ${py} bg-slate-900/50 border ${border} border-r-0 rounded-l-lg ${txt} text-white hover:bg-slate-800 transition-colors shrink-0 select-none`}
      >
        <span className="text-base leading-none">{country.flag}</span>
        <span className="text-slate-400 text-xs w-8 text-left">{country.dial}</span>
        <ChevronDown
          size={11}
          className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Number input */}
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={numberPart}
        onChange={handleNumber}
        placeholder={country.placeholder}
        className={`flex-1 min-w-0 px-3 ${py} bg-slate-900/50 border ${border} rounded-r-lg ${txt} text-white placeholder-slate-500 focus:outline-none focus:ring-1 ${focusBorder} transition-all`}
      />

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-60 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1">
          {COUNTRIES.map(c => (
            <button
              key={c.code}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectCountry(c)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-700 transition-colors text-left ${
                country.code === c.code ? 'bg-slate-700/60 text-teal-400' : 'text-slate-200'
              }`}
            >
              <span className="text-base">{c.flag}</span>
              <span className="text-slate-500 text-xs w-9 shrink-0">{c.dial}</span>
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
