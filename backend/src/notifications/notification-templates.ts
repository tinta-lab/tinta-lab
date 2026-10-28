// Telegram HTML for each notification type, rendered at send time from the
// outbox payload. Every interpolated value goes through esc(): names, emails
// and HA usernames are untrusted (an unescaped `_` in an HA username once
// made Telegram reject — i.e. drop — the security alert about that user).
// Each message ends with the short outbox id, so a duplicate delivery
// (at-least-once) is recognisable as the same event.

export interface SecurityAnomalyPayload {
  clientName: string | null;
  serverName: string | null;
  accessLogId: string;
  anomalies: { type: string; detail: string }[];
}

export interface ProvisioningCompletePayload {
  clientName: string;
  clientEmail: string;
  serverName: string;
  subdomain: string;
  dashboardUrl: string;
}

export interface AgentOfflinePayload {
  clientName: string;
  clientId: string;
  lastSeen: string | null; // ISO
}

export interface AccessGrantedPayload {
  clientName: string;
  clientEmail: string;
  serverName: string;
  serverUrl: string;
  expiresAt: string; // ISO
}

export interface AccessRevokedPayload {
  clientName: string;
  serverName: string;
  reason: 'manual' | 'expired';
}

export function renderNotification(
  eventType: string,
  payload: Record<string, unknown>,
  id: string,
  isTest = false,
): string {
  const body = renderBody(eventType, payload);
  const prefix = isTest
    ? `🧪 <b>ТЕСТ</b> — проверка доставки, действий не требуется\n\n`
    : '';
  return `${prefix}${body}\n\n<code>#${esc(id.slice(0, 8))}</code>`;
}

function renderBody(eventType: string, raw: Record<string, unknown>): string {
  switch (eventType) {
    case 'security_anomaly': {
      const p = raw as unknown as SecurityAnomalyPayload;
      const lines = (p.anomalies ?? [])
        .map((a) => `• ${esc(a.detail)}`)
        .join('\n');
      return (
        `🚨 <b>ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ В SUPPORT-СЕССИИ</b>\n\n` +
        `👤 Клиент: ${esc(p.clientName ?? 'не определён')}\n` +
        `🏠 Сервер: ${esc(p.serverName ?? 'не определён')}\n\n` +
        `${lines}\n\n` +
        `<i>Обнаружено при закрытии доступа поддержки. Найденные новые администраторы ` +
        `в HA клиента уже удалены автоматически. Проверьте журнал аудита и, если это ` +
        `не действие клиента, свяжитесь с сотрудником, который вёл сессию.</i>`
      );
    }
    // No token fragments — they were never useful in a chat message and
    // Telegram is a third-party service.
    case 'provisioning_complete': {
      const p = raw as unknown as ProvisioningCompletePayload;
      return (
        `🚀 <b>Новый клиент провижинен</b>\n\n` +
        `👤 ${esc(p.clientName)} (${esc(p.clientEmail)})\n` +
        `🏠 Сервер: ${esc(p.serverName)}\n` +
        `🌐 Поддомен: ${esc(p.subdomain)}\n` +
        `🔗 Dashboard: ${esc(p.dashboardUrl)}`
      );
    }
    case 'agent_offline': {
      const p = raw as unknown as AgentOfflinePayload;
      const lastSeen = p.lastSeen
        ? new Date(p.lastSeen).toLocaleString('de-DE')
        : 'неизвестно';
      return (
        `🔴 <b>Агент офлайн</b>\n\n` +
        `👤 ${esc(p.clientName)}\n` +
        `🆔 Client ID: <code>${esc(p.clientId)}</code>\n` +
        `⏱ Последний heartbeat: ${esc(lastSeen)}`
      );
    }
    case 'access_granted': {
      const p = raw as unknown as AccessGrantedPayload;
      const expires = new Date(p.expiresAt).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return (
        `🟢 <b>Доступ открыт</b>\n\n` +
        `👤 Клиент: ${esc(p.clientName)} (${esc(p.clientEmail)})\n` +
        `🏠 Сервер: ${esc(p.serverName)}\n` +
        `🔗 Ссылка: ${esc(p.serverUrl)}\n` +
        `⏱ Истекает в: ${esc(expires)}\n\n` +
        `<i>Нажмите ссылку чтобы подключиться к Home Assistant</i>`
      );
    }
    case 'access_revoked': {
      const p = raw as unknown as AccessRevokedPayload;
      const icon = p.reason === 'expired' ? '⏰' : '🔴';
      const text =
        p.reason === 'expired' ? 'истёк автоматически' : 'закрыт клиентом';
      return (
        `${icon} <b>Доступ ${text}</b>\n\n` +
        `👤 Клиент: ${esc(p.clientName)}\n` +
        `🏠 Сервер: ${esc(p.serverName)}`
      );
    }
    default:
      return `ℹ️ <b>${esc(eventType)}</b>`;
  }
}

// Telegram's HTML mode only needs &, < and > escaped in text.
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
