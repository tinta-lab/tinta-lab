import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import TelegramBot from 'node-telegram-bot-api';

export interface SendResult {
  ok: boolean;
  httpAttempts: number;
  // Safe, aggregatable code — never a raw message (no data, no token):
  // timeout | rate_limited | network | telegram_<status> | budget_exhausted | error
  errorCode: string | null;
}

// One delivery attempt to Telegram, as the outbox dispatcher sees it. Never
// throws, and the whole call — HTTP attempts, 429 waits, pauses — fits one
// 45s budget: each HTTP call gets at most 10s of what's left, a 429 waits out
// retry_after (≤30s) only if that plus a useful next call still fits, a
// rejected/failed formatted message is re-sent as plain text, at most 3 HTTP
// calls. Every outcome is one structured log line (telegram.sent / .retry /
// .failed).
//
// At-least-once, not exactly-once: when a call times out or the connection
// drops after Telegram already accepted the message, the retry sends it
// again. Bot API has no idempotency key; messages carry the outbox id so a
// duplicate is recognisable.
@Injectable()
export class TelegramSender implements OnModuleInit {
  private readonly logger = new Logger(TelegramSender.name);
  private bot: TelegramBot | null = null;
  private chatId: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    this.chatId = this.config.get<string>('TELEGRAM_CHAT_ID') ?? null;
    if (!token || !this.chatId) {
      // One line at startup, deliberately WARN: notifications then pile up
      // in the outbox (visible as a growing queue in Grafana) and security
      // anomaly alerts reach no one except the access log.
      this.logger.warn(
        'Telegram not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID unset): notifications stay queued in notification_outbox — check the access log for security anomalies',
      );
      return;
    }
    this.bot = new TelegramBot(token);
    this.logger.log('Telegram notifications enabled');
  }

  get configured(): boolean {
    return !!this.bot && !!this.chatId;
  }

  async send(kind: string, html: string): Promise<SendResult> {
    if (!this.bot || !this.chatId) {
      return { ok: false, httpAttempts: 0, errorCode: 'not_configured' };
    }
    const deadline = Date.now() + SEND_BUDGET_MS;
    let plain = false;
    for (let attempt = 1; ; attempt++) {
      const mode = plain ? 'plain' : 'html';
      try {
        await withTimeout(
          plain
            ? this.bot.sendMessage(this.chatId, htmlToPlain(html))
            : this.bot.sendMessage(this.chatId, html, { parse_mode: 'HTML' }),
          Math.max(1, Math.min(SEND_TIMEOUT_MS, deadline - Date.now())),
        );
        this.logger.log(
          `telegram.sent kind=${kind} mode=${mode} attempts=${attempt}`,
        );
        return { ok: true, httpAttempts: attempt, errorCode: null };
      } catch (err) {
        const reason = describeError(err);
        const code = errorCode(err);
        const fail = (finalCode: string, why = ''): SendResult => {
          this.logger.error(
            `telegram.failed kind=${kind} mode=${mode} attempts=${attempt} error="${reason}"${why}`,
          );
          return { ok: false, httpAttempts: attempt, errorCode: finalCode };
        };
        if (attempt >= SEND_MAX_ATTEMPTS) return fail(code);

        const retryAfter = retryAfterSeconds(err);
        let waitMs: number;
        let retryNote: string;
        if (retryAfter !== null) {
          if (retryAfter > MAX_RETRY_AFTER_S) {
            return fail(
              'rate_limited',
              ` reason=retry_after_too_long wait=${retryAfter}s`,
            );
          }
          waitMs = retryAfter * 1000;
          retryNote = `reason=rate_limited wait=${retryAfter}s`;
        } else if (!plain) {
          plain = true;
          waitMs = 0;
          retryNote = `error="${reason}" next=plain`;
        } else {
          waitMs = RETRY_PAUSE_MS;
          retryNote = `error="${reason}" wait=${RETRY_PAUSE_MS / 1000}s`;
        }
        if (Date.now() + waitMs + MIN_ATTEMPT_MS > deadline) {
          return fail('budget_exhausted', ' reason=budget_exhausted');
        }
        this.logger.warn(
          `telegram.retry kind=${kind} mode=${mode} attempt=${attempt} ${retryNote}`,
        );
        if (waitMs) await sleep(waitMs);
      }
    }
  }
}

const SEND_BUDGET_MS = 45_000;
const SEND_TIMEOUT_MS = 10_000;
const MIN_ATTEMPT_MS = 3_000;
const SEND_MAX_ATTEMPTS = 3;
const MAX_RETRY_AFTER_S = 30;
const RETRY_PAUSE_MS = 2_000;

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

function errorCode(err: unknown): string {
  const e = err as {
    code?: string;
    message?: string;
    response?: { statusCode?: number };
  };
  if (e?.message?.startsWith('timed out after')) return 'timeout';
  if (retryAfterSeconds(err) !== null) return 'rate_limited';
  if (e?.code === 'EFATAL') return 'network';
  if (e?.code === 'ETELEGRAM') {
    const status =
      e.response?.statusCode ?? /ETELEGRAM: (\d{3})/.exec(e.message ?? '')?.[1];
    return status ? `telegram_${status}` : 'telegram_error';
  }
  return 'error';
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
