import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private bot: TelegramBot | null = null;
  private chatId: string | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.configService.get<string>('TELEGRAM_CHAT_ID') ?? null;

    if (!token || !this.chatId) {
      // One line at startup, deliberately WARN: without Telegram, security
      // anomaly alerts from agents reach no one (they're only in the
      // access log), which is a real gap, not just a missing nicety.
      this.logger.warn(
        'Telegram not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID unset): provisioning notices and security-anomaly alerts are not sent — check the access log',
      );
      return;
    }

    this.bot = new TelegramBot(token);
    this.logger.log('Telegram notifications enabled');
  }

  async notifyAccessGranted(params: {
    clientName: string;
    clientEmail: string;
    serverName: string;
    serverUrl: string;
    expiresAt: Date;
  }) {
    const { clientName, clientEmail, serverName, serverUrl, expiresAt } =
      params;
    const expires = expiresAt.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await this.send(
      'access_granted',
      `🟢 <b>Доступ открыт</b>\n\n` +
        `👤 Клиент: ${esc(clientName)} (${esc(clientEmail)})\n` +
        `🏠 Сервер: ${esc(serverName)}\n` +
        `🔗 Ссылка: ${esc(serverUrl)}\n` +
        `⏱ Истекает в: ${esc(expires)}\n\n` +
        `<i>Нажмите ссылку чтобы подключиться к Home Assistant</i>`,
    );
  }

  // No token fragments here — they were never useful in a chat message and
  // Telegram is a third-party service.
  async notifyProvisioningComplete(params: {
    clientName: string;
    clientEmail: string;
    serverName: string;
    subdomain: string;
    dashboardUrl: string;
  }) {
    const { clientName, clientEmail, serverName, subdomain, dashboardUrl } =
      params;
    await this.send(
      'provisioning_complete',
      `🚀 <b>Новый клиент провижинен</b>\n\n` +
        `👤 ${esc(clientName)} (${esc(clientEmail)})\n` +
        `🏠 Сервер: ${esc(serverName)}\n` +
        `🌐 Поддомен: ${esc(subdomain)}\n` +
        `🔗 Dashboard: ${esc(dashboardUrl)}`,
    );
  }

  async notifyAgentOffline(params: {
    clientName: string;
    clientId: string;
    lastSeen: Date | null;
  }) {
    await this.send(
      'agent_offline',
      `🔴 <b>Агент офлайн</b>\n\n` +
        `👤 ${esc(params.clientName)}\n` +
        `🆔 Client ID: <code>${esc(params.clientId)}</code>\n` +
        `⏱ Последний heartbeat: ${esc(params.lastSeen?.toLocaleString('de-DE') ?? 'неизвестно')}`,
    );
  }

  async notifyAccessRevoked(params: {
    clientName: string;
    serverName: string;
    reason: 'manual' | 'expired';
  }) {
    const { clientName, serverName, reason } = params;
    const icon = reason === 'expired' ? '⏰' : '🔴';
    const text =
      reason === 'expired' ? 'истёк автоматически' : 'закрыт клиентом';

    await this.send(
      'access_revoked',
      `${icon} <b>Доступ ${text}</b>\n\n` +
        `👤 Клиент: ${esc(clientName)}\n` +
        `🏠 Сервер: ${esc(serverName)}`,
    );
  }

  // anomaly details carry usernames from the client's HA — i.e. whatever a
  // rogue session chose to name the account it created. Unescaped, an odd
  // `_` in that name made Telegram reject the message and the alert vanished.
  async notifySecurityAnomaly(params: {
    clientName: string;
    serverName: string;
    anomalies: { type: string; detail: string }[];
  }) {
    const { clientName, serverName, anomalies } = params;
    const lines = anomalies.map((a) => `• ${esc(a.detail)}`).join('\n');

    await this.send(
      'security_anomaly',
      `🚨 <b>ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ В SUPPORT-СЕССИИ</b>\n\n` +
        `👤 Клиент: ${esc(clientName)}\n` +
        `🏠 Сервер: ${esc(serverName)}\n\n` +
        `${lines}\n\n` +
        `<i>Обнаружено при закрытии доступа поддержки. Найденные новые администраторы ` +
        `в HA клиента уже удалены автоматически. Проверьте журнал аудита и, если это ` +
        `не действие клиента, свяжитесь с сотрудником, который вёл сессию.</i>`,
    );
  }

  // HTML with every interpolated value escaped. Never throws and never
  // hangs: each attempt is bounded, a 429 waits out Telegram's retry_after
  // (up to 30s) once, a rejected/failed formatted message is re-sent as
  // plain text so an alert isn't lost to formatting. Every outcome is one
  // structured log line (telegram.sent / .retry / .failed / .skipped), so
  // "no alerts" can be told apart from "alerts not delivered".
  private async send(kind: string, html: string): Promise<void> {
    if (!this.bot || !this.chatId) {
      this.logger.warn(`telegram.skipped kind=${kind} reason=not_configured`);
      return;
    }
    let plain = false;
    for (let attempt = 1; attempt <= SEND_MAX_ATTEMPTS; attempt++) {
      const mode = plain ? 'plain' : 'html';
      try {
        await withTimeout(
          plain
            ? this.bot.sendMessage(this.chatId, htmlToPlain(html))
            : this.bot.sendMessage(this.chatId, html, { parse_mode: 'HTML' }),
          SEND_TIMEOUT_MS,
        );
        this.logger.log(
          `telegram.sent kind=${kind} mode=${mode} attempts=${attempt}`,
        );
        return;
      } catch (err) {
        const reason = describeError(err);
        if (attempt === SEND_MAX_ATTEMPTS) {
          this.logger.error(
            `telegram.failed kind=${kind} mode=${mode} attempts=${attempt} error="${reason}"`,
          );
          return;
        }
        const retryAfter = retryAfterSeconds(err);
        if (retryAfter !== null) {
          if (retryAfter > MAX_RETRY_AFTER_S) {
            this.logger.error(
              `telegram.failed kind=${kind} mode=${mode} attempts=${attempt} error="${reason}" (retry_after ${retryAfter}s too long)`,
            );
            return;
          }
          this.logger.warn(
            `telegram.retry kind=${kind} mode=${mode} attempt=${attempt} reason=rate_limited wait=${retryAfter}s`,
          );
          await sleep(retryAfter * 1000);
        } else if (!plain) {
          this.logger.warn(
            `telegram.retry kind=${kind} mode=html attempt=${attempt} error="${reason}" next=plain`,
          );
          plain = true;
        } else {
          this.logger.warn(
            `telegram.retry kind=${kind} mode=plain attempt=${attempt} error="${reason}"`,
          );
          await sleep(RETRY_PAUSE_MS);
        }
      }
    }
  }
}

const SEND_TIMEOUT_MS = 10_000;
const SEND_MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_S = 30;
const RETRY_PAUSE_MS = 2_000;

// Telegram's HTML mode only needs &, < and > escaped in text.
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Only the message, never the error object: node-telegram-bot-api errors
// carry the request URL — bot token included — in `cause`/`response`.
// The token pattern is masked here too, in case it ever reaches a message.
function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.replace(/\d{6,}:[A-Za-z0-9_-]{30,}/g, '<bot-token>');
}

function retryAfterSeconds(err: unknown): number | null {
  const value = (
    err as { response?: { body?: { parameters?: { retry_after?: unknown } } } }
  )?.response?.body?.parameters?.retry_after;
  return typeof value === 'number' && value >= 0 ? value : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
