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
      `🚨 <b>ПОДОЗРИТЕЛЬНАЯ АКТИВНОСТЬ В SUPPORT-СЕССИИ</b>\n\n` +
        `👤 Клиент: ${esc(clientName)}\n` +
        `🏠 Сервер: ${esc(serverName)}\n\n` +
        `${lines}\n\n` +
        `<i>Обнаружено при закрытии доступа поддержки. Найденные новые администраторы ` +
        `в HA клиента уже удалены автоматически. Проверьте журнал аудита и, если это ` +
        `не действие клиента, свяжитесь с сотрудником, который вёл сессию.</i>`,
    );
  }

  // HTML with every interpolated value escaped. If Telegram still refuses
  // the message, it's re-sent as plain text: an alert must not be lost to
  // formatting.
  private async send(html: string) {
    if (!this.bot || !this.chatId) return;
    try {
      await this.bot.sendMessage(this.chatId, html, { parse_mode: 'HTML' });
      return;
    } catch (err) {
      this.logger.warn(
        `Telegram rejected the formatted message, retrying as plain text: ${errorMessage(err)}`,
      );
    }
    try {
      await this.bot.sendMessage(this.chatId, htmlToPlain(html));
    } catch (err) {
      this.logger.error(`Telegram send failed: ${errorMessage(err)}`);
    }
  }
}

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

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
