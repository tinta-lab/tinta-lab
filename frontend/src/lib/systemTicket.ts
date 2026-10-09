import type { TranslationKey } from '@/i18n/translations';

// System tickets (backend agent-monitor.scheduler.ts) are stored with a
// fixed Russian subject/body so existing rows stay parseable. The UI never
// shows that raw text: it recognises the pattern and renders it in the
// selected language. Anything else is user-written and shown as-is.
const OFFLINE_SUBJECT = /^\[AUTO\] Агент офлайн: (.+)$/;

type T = (k: TranslationKey) => string;

export function isSystemTicket(subject: string): boolean {
  return subject.startsWith('[AUTO]');
}

export function ticketSubject(subject: string, t: T): string {
  const m = subject.match(OFFLINE_SUBJECT);
  return m ? `${t('auto_ticket_offline_subject')}: ${m[1]}` : subject;
}

export function ticketMessage(subject: string, message: string, t: T): string {
  if (!OFFLINE_SUBJECT.test(subject)) return message;
  const pick = (label: string) => message.match(new RegExp(`${label}:\\s*(.+)`))?.[1]?.trim() ?? '—';
  return t('auto_ticket_offline_message')
    .replace('{heartbeat}', pick('Последний heartbeat'))
    .replace('{agent}', pick('Версия агента'))
    .replace('{ha}', pick('Версия HA'));
}
