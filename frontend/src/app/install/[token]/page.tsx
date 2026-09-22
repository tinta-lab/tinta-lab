'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import { Check, Copy, AlertTriangle, Loader2, Shield, Wifi, ExternalLink, Clock, RefreshCw } from 'lucide-react';

// Display-only fields from the non-consuming preview endpoint. Deliberately
// excludes agentToken/tunnelToken/clientId — those are enrollment secrets
// the Agent fetches itself via GET /install/:token (see backend
// provisioning.service.ts getInstallPreview() doc comment for why this page
// must never call that endpoint directly: doing so used to consume the
// one-time install token before the Agent ever got a chance to).
interface InstallPreview {
  serverName: string;
  clientName: string;
  externalUrl: string;
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

// Distinguishes WHY the request failed, not just THAT it failed — a 429
// (temporary, will resolve itself) must never look like a 404/410 (the
// token itself is genuinely dead) to the person reading the page. An
// Agent crash-looping on the expected "consent not given yet" 403 can
// burn through install.controller.ts's 10-req/15min throttle, so the
// very next legitimate request — the browser's own GET right after the
// client completes consent — gets a 429 too. Before this fix, every
// non-410/404 status (429 included) fell into a generic branch and was
// shown under the headline "Ссылка недействительна" (link invalid), even
// though the token was valid and consent had just succeeded. That
// headline is not just imprecise, it's actively wrong for a 429 and
// tells the client to do the one thing that won't help (find the admin
// for a new link) instead of the one thing that will (wait a few minutes
// and reload).
type InstallErrorKind = 'expired' | 'notfound' | 'ratelimited' | 'server' | 'unknown';

interface InstallError {
  kind: InstallErrorKind;
  message: string;
  retryAfterSec?: number;
}

function classifyInstallError(err: unknown): InstallError {
  const status = axios.isAxiosError(err) ? err.response?.status : undefined;
  if (status === 410) {
    return { kind: 'expired', message: 'Ссылка истекла. Попросите администратора выдать новую.' };
  }
  if (status === 404) {
    return { kind: 'notfound', message: 'Ссылка не найдена или уже была использована ранее.' };
  }
  if (status === 429) {
    const retryAfterHeader = axios.isAxiosError(err) ? err.response?.headers?.['retry-after'] : undefined;
    const retryAfterSec = retryAfterHeader ? parseInt(String(retryAfterHeader), 10) : undefined;
    const waitText = retryAfterSec && Number.isFinite(retryAfterSec)
      ? `примерно ${Math.ceil(retryAfterSec / 60)} мин.`
      : 'несколько минут';
    return {
      kind: 'ratelimited',
      message: `Слишком много попыток за короткое время. Ссылка по-прежнему действительна — подождите ${waitText} и обновите страницу.`,
      retryAfterSec,
    };
  }
  if (status && status >= 500) {
    return { kind: 'server', message: 'Временная проблема на сервере. Ссылка по-прежнему действительна — попробуйте обновить страницу через минуту.' };
  }
  return { kind: 'unknown', message: 'Не удалось загрузить конфигурацию. Попробуйте обновить страницу через минуту.' };
}

const INSTALL_ERROR_TITLES: Record<InstallErrorKind, string> = {
  expired: 'Ссылка истекла',
  notfound: 'Ссылка недействительна',
  ratelimited: 'Слишком много попыток',
  server: 'Временная проблема',
  unknown: 'Не удалось загрузить',
};

export default function InstallPage() {
  const { token } = useParams<{ token: string }>();
  const [config, setConfig] = useState<InstallPreview | null>(null);
  const [error, setError] = useState<InstallError | null>(null);
  const [loading, setLoading] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consenting, setConsenting] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  const confirmConsentAndLoad = () => {
    setLoading(true);
    setConsenting(true);
    setError(null);
    axios.post(`${apiUrl}/install/${token}/consent`)
      .then(() => axios.get<InstallPreview>(`${apiUrl}/install/${token}/preview`))
      .then(r => setConfig(r.data))
      .catch(err => setError(classifyInstallError(err)))
      .finally(() => { setLoading(false); setConsenting(false); });
  };

  // Retryable errors (rate limit, transient server issue) get a real retry
  // button instead of forcing a full page reload — same request, same
  // classification, so a resolved rate limit or a recovered backend
  // succeeds without the person needing to re-tick the consent checkbox.
  const retryLoad = () => {
    setLoading(true);
    setError(null);
    axios.get<InstallPreview>(`${apiUrl}/install/${token}/preview`)
      .then(r => setConfig(r.data))
      .catch(err => setError(classifyInstallError(err)))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Consent gate — must be confirmed before the config request fires at all,
  // so "the client started installing" can never stand in for the explicit
  // § 356 Abs. 4 BGB acknowledgment (see AgentSession.serviceStartConsentAt).
  if (!config && !error && !consenting) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="flex items-center gap-3 mb-6">
            <img src="/wordmark.png" alt="Tinta Lab" width={160} height={40} className="h-8 w-auto" />
          </div>
          <h1 className="text-xl font-bold mb-3">Bevor wir beginnen</h1>
          <p className="text-sm text-slate-400 mb-4">
            Sobald Sie fortfahren, beginnt Tinta Lab mit der Ausführung der
            gebuchten Dienstleistung (Einrichtung des Fernzugriffs auf Ihr
            Home-Assistant-System).
          </p>
          <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
              className="mt-1 w-4 h-4 accent-blue-600 shrink-0"
            />
            <span className="text-sm text-slate-300">
              Ich stimme ausdrücklich zu, dass Tinta Lab mit der Ausführung der
              Dienstleistung vor Ablauf der 14-tägigen Widerrufsfrist beginnt.
              Mir ist bekannt, dass ich bei vollständiger Vertragserfüllung mein
              Widerrufsrecht verliere (§ 356 Abs. 4 BGB).
              <span className="block text-slate-500 mt-1">
                Я согласен(на), что Tinta Lab начнёт оказание услуги до истечения
                14-дневного срока отказа от договора, и понимаю, что при полном
                исполнении услуги теряю право на отказ.
              </span>
            </span>
          </label>
          <button
            onClick={confirmConsentAndLoad}
            disabled={!consentChecked}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Bestätigen und fortfahren
          </button>
        </div>
      </div>
    );
  }

  if (error || !config) {
    // 404/410: the token itself is genuinely dead — nothing to retry, only
    // a new link from an admin helps. 429/5xx/unknown: the token is fine,
    // this is transient — offer a real retry instead of a dead end.
    const kind = error?.kind ?? 'unknown';
    const isTerminal = kind === 'expired' || kind === 'notfound';
    const Icon = isTerminal ? AlertTriangle : Clock;
    const iconColor = isTerminal ? 'text-red-400' : 'text-amber-400';
    const iconBg = isTerminal ? 'bg-red-900/30' : 'bg-amber-900/30';

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className={`w-14 h-14 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-7 h-7 ${iconColor}`} />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">{INSTALL_ERROR_TITLES[kind]}</h1>
          <p className="text-slate-400 text-sm mb-5">{error?.message}</p>
          {!isTerminal && (
            <button
              onClick={retryLoad}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <RefreshCw size={14} />
              Попробовать снова
            </button>
          )}
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
