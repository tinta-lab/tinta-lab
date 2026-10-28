import { Logger } from '@nestjs/common';
import { TelegramSender } from './telegram-sender';

// One delivery attempt as the outbox dispatcher sees it: bounded in time,
// 429-aware, falls back to plain text, reports a safe error code, and never
// logs the bot token (node-telegram-bot-api errors carry it in the request
// URL inside the error object).
describe('TelegramSender', () => {
  const TOKEN = '1234567890:AAAAbbbbCCCCddddEEEEffffGGGGhhhhIIII';
  const HTML = '🚨 <b>Alert</b>\n\nuser evil_admin*&lt;b&gt; &amp; co';
  let logs: string[];

  beforeEach(() => {
    logs = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          logs.push(`${level}: ${args.map(String).join(' ')}`);
        });
    }
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function setup(sendMessage: jest.Mock = jest.fn().mockResolvedValue({})) {
    const sender = new TelegramSender({ get: jest.fn() } as any);
    (sender as any).bot = { sendMessage };
    (sender as any).chatId = '42';
    return { sender, sendMessage };
  }

  function telegramError(message: string, extra: object = {}) {
    return Object.assign(new Error(message), {
      code: 'ETELEGRAM',
      response: {
        request: { href: `https://api.telegram.org/bot${TOKEN}/sendMessage` },
      },
      ...extra,
    });
  }
  const rateLimited = (seconds: number) =>
    telegramError('ETELEGRAM: 429 Too Many Requests', {
      response: { body: { parameters: { retry_after: seconds } } },
    });

  it('sends HTML and reports success', async () => {
    const { sender, sendMessage } = setup();
    const result = await sender.send('security_anomaly', HTML);
    expect(result).toEqual({ ok: true, httpAttempts: 1, errorCode: null });
    expect(sendMessage).toHaveBeenCalledWith('42', HTML, {
      parse_mode: 'HTML',
    });
    expect(logs).toContain(
      'log: telegram.sent kind=security_anomaly mode=html attempts=1',
    );
  });

  it('falls back to plain text when Telegram rejects the formatted message', async () => {
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(
        telegramError("ETELEGRAM: 400 Bad Request: can't parse entities"),
      )
      .mockResolvedValueOnce({});
    const { sender } = setup(sendMessage);

    const result = await sender.send('security_anomaly', HTML);

    expect(result.ok).toBe(true);
    expect(result.httpAttempts).toBe(2);
    const [, plain, opts] = sendMessage.mock.calls[1] as [string, string, any];
    expect(opts).toBeUndefined();
    expect(plain).toContain('user evil_admin*<b> & co');
    // markup gone, user data (escaped in HTML) restored literally
    expect(plain).toContain('🚨 Alert');
    expect(plain).not.toContain('<b>Alert</b>');
  });

  it('waits out a short 429 and retries the same formatted message', async () => {
    jest.useFakeTimers();
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(rateLimited(3))
      .mockResolvedValueOnce({});
    const { sender } = setup(sendMessage);

    const done = sender.send('security_anomaly', HTML);
    await jest.advanceTimersByTimeAsync(3_000);
    expect((await done).ok).toBe(true);
    expect(sendMessage.mock.calls[1][2]).toEqual({ parse_mode: 'HTML' });
  });

  it('gives up on a 429 asking to wait too long', async () => {
    const { sender, sendMessage } = setup(
      jest.fn().mockRejectedValue(rateLimited(600)),
    );
    const result = await sender.send('security_anomaly', HTML);
    expect(result).toEqual({
      ok: false,
      httpAttempts: 1,
      errorCode: 'rate_limited',
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it('stops when a second 429 wait would exceed the 45s budget', async () => {
    jest.useFakeTimers();
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(rateLimited(30))
      .mockRejectedValueOnce(rateLimited(30));
    const { sender } = setup(sendMessage);

    const done = sender.send('security_anomaly', HTML);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(await done).toEqual({
      ok: false,
      httpAttempts: 2,
      errorCode: 'budget_exhausted',
    });
  });

  it('bounds a hanging request (timeout) and finishes within 45s in the worst mix', async () => {
    jest.useFakeTimers();
    const start = Date.now();
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(rateLimited(30))
      .mockReturnValue(new Promise(() => undefined));
    const { sender } = setup(sendMessage);

    let result: unknown;
    const done = sender
      .send('security_anomaly', HTML)
      .then((r) => (result = r));
    await jest.advanceTimersByTimeAsync(45_000);
    await done;

    expect(Date.now() - start).toBeLessThanOrEqual(45_000);
    expect(result).toEqual({
      ok: false,
      httpAttempts: 3,
      errorCode: 'timeout',
    });
  });

  it('stops after 3 calls with a safe error code and never logs the token', async () => {
    jest.useFakeTimers();
    const sendMessage = jest.fn().mockRejectedValue(
      telegramError(`EFATAL: Error: connect ECONNREFUSED (bot${TOKEN})`, {
        code: 'EFATAL',
      }),
    );
    const { sender } = setup(sendMessage);

    const done = sender.send('provisioning_complete', HTML);
    await jest.advanceTimersByTimeAsync(5_000);
    expect(await done).toEqual({
      ok: false,
      httpAttempts: 3,
      errorCode: 'network',
    });
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(logs.join('\n')).toContain('<bot-token>');
  });

  it('reports not_configured without trying when Telegram is not set up', async () => {
    const sender = new TelegramSender({ get: jest.fn() } as any);
    expect(sender.configured).toBe(false);
    expect(await sender.send('security_anomaly', HTML)).toEqual({
      ok: false,
      httpAttempts: 0,
      errorCode: 'not_configured',
    });
  });
});
