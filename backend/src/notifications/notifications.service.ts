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
      this.logger.warn('Telegram not configured — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
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
    const { clientName, clientEmail, serverName, serverUrl, expiresAt } = params;
    const expires = expiresAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    await this.send(
      `🟢 *Доступ открыт*\n\n` +
      `👤 Клиент: ${clientName} (${clientEmail})\n` +
      `🏠 Сервер: ${serverName}\n` +
      `🔗 Ссылка: ${serverUrl}\n` +
      `⏱ Истекает в: ${expires}\n\n` +
      `_Нажмите ссылку чтобы подключиться к Home Assistant_`
    );
  }

  async notifyProvisioningComplete(params: {
    clientName: string;
    clientEmail: string;
    serverName: string;
    subdomain: string;
    dashboardUrl: string;
    agentToken: string;
    tunnelToken: string | null;
  }) {
    const { clientName, clientEmail, serverName, subdomain, dashboardUrl, agentToken, tunnelToken } = params;
    await this.send(
      `🚀 *Новый клиент провижинен*\n\n` +
      `👤 ${clientName} (${clientEmail})\n` +
      `🏠 Сервер: ${serverName}\n` +
      `🌐 Поддомен: ${subdomain}\n` +
      `🔗 Dashboard: ${dashboardUrl}\n\n` +
      `*Agent JWT:* \`${agentToken.slice(0, 20)}...\`\n` +
      (tunnelToken ? `*Tunnel Token:* \`${tunnelToken.slice(0, 20)}...\`\n` : '') +
      `\n_Все токены показаны частично. Полные — в API ответе._`,
    );
  }

  async notifyAgentOffline(params: { clientName: string; clientId: string; lastSeen: Date | null }) {
    await this.send(
      `🔴 *Агент офлайн*\n\n` +
      `👤 ${params.clientName}\n` +
      `🆔 Client ID: \`${params.clientId}\`\n` +
      `⏱ Последний heartbeat: ${params.lastSeen?.toLocaleString('de-DE') ?? 'неизвестно'}`,
    );
  }

  async notifyAccessRevoked(params: {
    clientName: string;
    serverName: string;
    reason: 'manual' | 'expired';
  }) {
    const { clientName, serverName, reason } = params;
    const icon = reason === 'expired' ? '⏰' : '🔴';
    const text = reason === 'expired' ? 'истёк автоматически' : 'закрыт клиентом';

    await this.send(
      `${icon} *Доступ ${text}*\n\n` +
      `👤 Клиент: ${clientName}\n` +
      `🏠 Сервер: ${serverName}`
    );
  }

  private async send(text: string) {
    if (!this.bot || !this.chatId) return;
    try {
      await this.bot.sendMessage(this.chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      this.logger.error('Telegram send failed:', err);
    }
  }
}
