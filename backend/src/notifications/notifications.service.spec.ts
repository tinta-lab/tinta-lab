import { NotificationsService, esc } from './notifications.service';

// Messages used Markdown with nothing escaped: a name or email containing an
// odd `_`/`*` made Telegram reject the message — for security alerts that
// includes usernames chosen by whoever created a rogue HA admin, i.e. the
// alert could be suppressed by naming the account `evil_admin`.
describe('NotificationsService', () => {
  function setup(sendMessage: jest.Mock = jest.fn().mockResolvedValue({})) {
    const service = new NotificationsService({ get: jest.fn() } as any);
    (service as any).bot = { sendMessage };
    (service as any).chatId = '42';
    return { service, sendMessage };
  }

  it('escapes interpolated values for Telegram HTML', () => {
    expect(esc('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
    expect(esc(undefined)).toBe('');
  });

  it('sends security alerts as HTML with hostile names escaped', async () => {
    const { service, sendMessage } = setup();
    await service.notifySecurityAnomaly({
      clientName: 'Vik_Just_7',
      serverName: 'Haus <Test>',
      anomalies: [
        { type: 'new_admin', detail: 'new admin evil_admin*<b>x</b>' },
      ],
    });

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
  });

  it('re-sends as plain text when Telegram rejects the formatted message, so the alert is not lost', async () => {
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(new Error("Bad Request: can't parse entities"))
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
  });

  it('never throws, even if both attempts fail', async () => {
    const { service } = setup(
      jest.fn().mockRejectedValue(new Error('network')),
    );
    await expect(
      service.notifyProvisioningComplete({
        clientName: 'n',
        clientEmail: 'e',
        serverName: 's',
        subdomain: 'x',
        dashboardUrl: 'u',
      }),
    ).resolves.toBeUndefined();
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

  it('does nothing when Telegram is not configured', async () => {
    const service = new NotificationsService({ get: jest.fn() } as any);
    await expect(
      service.notifySecurityAnomaly({
        clientName: 'a',
        serverName: 'b',
        anomalies: [],
      }),
    ).resolves.toBeUndefined();
  });
});
