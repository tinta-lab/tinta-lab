'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { Check, Copy, AlertTriangle, Loader2, Shield, Wifi, ExternalLink } from 'lucide-react';

interface InstallConfig {
  clientId: string;
  agentToken: string;
  coreWs: string;
  externalUrl: string;
  tunnelToken: string | null;
  serverName: string;
  clientName: string;
  expiresAt: string;
}

function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5">
        <span className={`flex-1 text-sm text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>{value}</span>
        <button
          onClick={copy}
          className="shrink-0 p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-all"
        >
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
          {n}
        </div>
        <div className="flex-1 w-px bg-slate-700 mt-2" />
      </div>
      <div className="flex-1 pb-8">
        <h3 className="font-semibold text-white mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export default function InstallPage() {
  const { token } = useParams<{ token: string }>();
  const [config, setConfig] = useState<InstallConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    axios.get<InstallConfig>(`${apiUrl}/install/${token}`)
      .then(r => setConfig(r.data))
      .catch(err => {
        const status = err.response?.status;
        if (status === 410) setError('Ссылка истекла. Попросите администратора выдать новую.');
        else if (status === 404) setError('Ссылка не найдена или уже использована.');
        else setError('Не удалось загрузить конфигурацию. Попробуйте позже.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Ссылка недействительна</h1>
          <p className="text-slate-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const expiresIn = Math.ceil((new Date(config.expiresAt).getTime() - Date.now()) / 3_600_000);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Shield size={16} />
          </div>
          <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-8 w-auto" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Установка Tinta Agent</h1>
          <p className="text-slate-400">
            {config.clientName ? `${config.clientName} · ` : ''}{config.serverName}
          </p>
          {expiresIn > 0 && (
            <p className="text-xs text-amber-400 mt-2">
              Ссылка действительна ещё {expiresIn} ч.
            </p>
          )}
        </div>

        {/* Steps */}
        <div>
          <Step n={1} title="Установите Tinta Agent (HA Add-on)">
            <p className="text-sm text-slate-400 mb-3">
              В Home Assistant перейдите в <strong className="text-slate-200">Настройки → Дополнения → Магазин</strong>,
              добавьте репозиторий Tinta Agent и установите дополнение.
            </p>
          </Step>

          <Step n={2} title="Введите код активации">
            <p className="text-sm text-slate-400 mb-4">
              В настройках дополнения нужно заполнить только одно поле — всё остальное
              (адрес сервера, доступ к Home Assistant, публичный туннель) дополнение настроит
              само после сохранения.
            </p>
            <div className="space-y-3">
              <CopyField label="tinta_install_token" value={token} />
            </div>
          </Step>

          {/* Done step — no connector line */}
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center shrink-0">
              <Check size={16} />
            </div>
            <div className="flex-1 pt-1">
              <h3 className="font-semibold text-white">Готово</h3>
              <p className="text-sm text-slate-400 mt-1">
                После сохранения и запуска дополнение подключится к Tinta Lab и само поднимет
                защищённый доступ к вашей Home Assistant — без дополнительных дополнений и
                ручных токенов. Ваш Home Assistant будет доступен по адресу:
              </p>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 mt-3 mb-3">
                <Wifi size={14} className="text-slate-400 shrink-0" />
                <a
                  href={config.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  {config.externalUrl}
                  <ExternalLink size={11} />
                </a>
              </div>
              <p className="text-sm text-slate-400">
                Статус подключения появится на вашем{' '}
                <a href="https://app.tinta-lab.de" className="text-blue-400 hover:underline">
                  дашборде
                </a>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
