import { Logger } from '@nestjs/common';
import { NotificationsService, esc } from './notifications.service';

// Messages used Markdown with nothing escaped: a name or email containing an
// odd `_`/`*` made Telegram reject the message — for security alerts that
// includes usernames chosen by whoever created a rogue HA admin, i.e. the
// alert could be suppressed by naming the account `evil_admin`. Sending also
// had no timeout, no 429 handling, and logged the raw error object, which
// carries the bot token in its request URL.
describe('NotificationsService', () => {
  const TOKEN = '1234567890:AAAAbbbbCCCCddddEEEEffffGGGGhhhhIIII';
  let logs: string[];

  beforeEach(() => {
    logs = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((...args: unknown[]) => {
          logs.push(
            `${level}: ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`,
          );
        });
    }
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function setup(sendMessage: jest.Mock = jest.fn().mockResolvedValue({})) {
    const service = new NotificationsService({ get: jest.fn() } as any);
    (service as any).bot = { sendMessage };
    (service as any).chatId = '42';
    return { service, sendMessage };
  }

  // Shaped like node-telegram-bot-api errors: the token sits in the request
  // URL inside the object, not in the message.
  function telegramError(message: string, extra: object = {}) {
    return Object.assign(new Error(message), {
      code: 'ETELEGRAM',
      response: {
        request: { href: `https://api.telegram.org/bot${TOKEN}/sendMessage` },
      },
      ...extra,
    });
  }

  const anomaly = {
    clientName: 'Vik_Just_7',
    serverName: 'Haus <Test>',
    anomalies: [{ type: 'new_admin', detail: 'new admin evil_admin*<b>x</b>' }],
  };

  it('escapes interpolated values for Telegram HTML', () => {
    expect(esc('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
    expect(esc(undefined)).toBe('');
  });

  it('sends security alerts as HTML with hostile names escaped', async () => {
    const { service, sendMessage } = setup();
    await service.notifySecurityAnomaly(anomaly);

    const [chatId, text, opts] = sendMessage.mock.calls[0] as [
      string,
      string,
      any,
    ];
    expect(chatId).toBe('42');
    expect(opts).toEqual({ parse_mode: 'HTML' });
    expect(text).toContain('new admin evil_admin*&lt;b&gt;x&lt;/b&gt;');
    expect(text).toContain('Haus &lt;Test&gt;');
    expect(text).not.toContain('<b>x</b>');
    expect(logs).toContain(
      'log: telegram.sent kind=security_anomaly mode=html attempts=1',
    );
  });

  it('re-sends as plain text when Telegram rejects the formatted message', async () => {
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(
        telegramError("ETELEGRAM: 400 Bad Request: can't parse entities"),
      )
      .mockResolvedValueOnce({});
    const { service } = setup(sendMessage);

    await service.notifySecurityAnomaly({
      clientName: 'A & B',
      serverName: 'S',
      anomalies: [{ type: 't', detail: 'user <x>' }],
    });

    expect(sendMessage).toHaveBeenCalledTimes(2);
    const [, plain, opts] = sendMessage.mock.calls[1] as [string, string, any];
    expect(opts).toBeUndefined();
    expect(plain).toContain('A & B');
    expect(plain).toContain('user <x>');
    expect(plain).not.toMatch(/<\/?(b|i|code)>/);
    expect(logs).toContain(
      'log: telegram.sent kind=security_anomaly mode=plain attempts=2',
    );
  });

  it('waits out a short 429 retry_after and retries the same message', async () => {
    jest.useFakeTimers();
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(
        telegramError('ETELEGRAM: 429 Too Many Requests', {
          response: { body: { parameters: { retry_after: 3 } } },
        }),
      )
      .mockResolvedValueOnce({});
    const { service } = setup(sendMessage);

    const done = service.notifySecurityAnomaly(anomaly);
    await jest.advanceTimersByTimeAsync(3_000);
    await done;

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[1][2]).toEqual({ parse_mode: 'HTML' });
    expect(
      logs.some(
        (l) =>
          l.includes('telegram.retry') &&
          l.includes('reason=rate_limited wait=3s'),
      ),
    ).toBe(true);
  });

  it('gives up (logged) on a 429 asking to wait too long', async () => {
    const sendMessage = jest.fn().mockRejectedValue(
      telegramError('ETELEGRAM: 429 Too Many Requests', {
        response: { body: { parameters: { retry_after: 600 } } },
      }),
    );
    const { service } = setup(sendMessage);
    await service.notifySecurityAnomaly(anomaly);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(
      logs.some((l) =>
        l.startsWith('error: telegram.failed kind=security_anomaly'),
      ),
    ).toBe(true);
  });

  it('bounds a hanging request and still tries the fallback', async () => {
    jest.useFakeTimers();
    const sendMessage = jest
      .fn()
      .mockReturnValueOnce(new Promise(() => undefined))
      .mockResolvedValueOnce({});
    const { service } = setup(sendMessage);

    const done = service.notifySecurityAnomaly(anomaly);
    await jest.advanceTimersByTimeAsync(10_000);
    await done;

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(logs).toContain(
      'log: telegram.sent kind=security_anomaly mode=plain attempts=2',
    );
  });

  it('never throws, stops after 3 attempts, and logs the final failure without the token', async () => {
    jest.useFakeTimers();
    const sendMessage = jest
      .fn()
      .mockRejectedValue(
        telegramError(`EFATAL: Error: connect ECONNREFUSED (bot${TOKEN})`, {
          code: 'EFATAL',
        }),
      );
    const { service } = setup(sendMessage);

    const done = service.notifyProvisioningComplete({
      clientName: 'n',
      clientEmail: 'e',
      serverName: 's',
      subdomain: 'x',
      dashboardUrl: 'u',
    });
    await jest.advanceTimersByTimeAsync(5_000);
    await expect(done).resolves.toBeUndefined();

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(
      logs.some((l) =>
        l.startsWith('error: telegram.failed kind=provisioning_complete'),
      ),
    ).toBe(true);
    expect(logs.join('\n')).not.toContain(TOKEN);
    expect(logs.join('\n')).toContain('<bot-token>');
  });

  it('provisioning notice carries no token fragments', async () => {
    const { service, sendMessage } = setup();
    await service.notifyProvisioningComplete({
      clientName: 'Max',
      clientEmail: 'max_m@example.de',
      serverName: 'Haus',
      subdomain: 'haus.tinta-lab.de',
      dashboardUrl: 'https://haus.tinta-lab.de',
    });
    const text = sendMessage.mock.calls[0][1] as string;
    expect(text).toContain('max_m@example.de');
    expect(text).not.toMatch(/token|JWT/i);
  });

  it('logs a skipped alert when Telegram is not configured', async () => {
    const service = new NotificationsService({ get: jest.fn() } as any);
    await expect(
      service.notifySecurityAnomaly(anomaly),
    ).resolves.toBeUndefined();
    expect(logs).toContain(
      'warn: telegram.skipped kind=security_anomaly reason=not_configured',
    );
  });
});
