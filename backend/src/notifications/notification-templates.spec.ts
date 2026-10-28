import { esc, renderNotification } from './notification-templates';
import { backoffMs, policyFor } from './notification-policy';

describe('notification templates', () => {
  const ID = '0123abcd-1111-2222-3333-444455556666';

  it('escapes hostile names and HA usernames (an unescaped `_` once dropped the alert)', () => {
    const html = renderNotification(
      'security_anomaly',
      {
        clientName: 'Vik_Just_7',
        serverName: 'Haus <Test> & Co',
        accessLogId: 'a',
        anomalies: [
          { type: 'new_admin', detail: 'new admin evil_admin*<b>x</b>' },
        ],
      },
      ID,
    );
    expect(html).toContain('new admin evil_admin*&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('Haus &lt;Test&gt; &amp; Co');
    expect(html).not.toContain('<b>x</b>');
  });

  it('ends every message with the short outbox id, so duplicates are recognisable', () => {
    const html = renderNotification(
      'provisioning_complete',
      {
        clientName: 'Max',
        clientEmail: 'max_m@example.de',
        serverName: 'Haus',
        subdomain: 'haus.tinta-lab.de',
        dashboardUrl: 'https://haus.tinta-lab.de',
      },
      ID,
    );
    expect(html.endsWith('<code>#0123abcd</code>')).toBe(true);
    expect(html).not.toMatch(/token|JWT/i);
  });

  it('still renders a security alert when client/server names could not be resolved', () => {
    const html = renderNotification(
      'security_anomaly',
      {
        clientName: null,
        serverName: null,
        accessLogId: 'a',
        anomalies: [{ type: 't', detail: 'd' }],
      },
      ID,
    );
    expect(html).toContain('не определён');
    expect(html).toContain('• d');
  });

  it('esc handles &, <, > and empty values', () => {
    expect(esc('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
    expect(esc(null)).toBe('');
  });
});

describe('delivery policy', () => {
  it('retries security alerts for about a day before giving up', () => {
    const p = policyFor('security_anomaly');
    expect(p.priority).toBe(0);
    expect(p.maxAttempts).toBe(10);
    const totalMs = Array.from({ length: p.maxAttempts - 1 }, (_, i) =>
      backoffMs('security_anomaly', i + 1),
    ).reduce((a, b) => a + b, 0);
    expect(totalMs / 3_600_000).toBeGreaterThan(15);
    expect(totalMs / 3_600_000).toBeLessThan(24);
  });

  it('provisioning notices retry briefly; informational ones once', () => {
    expect(policyFor('provisioning_complete').maxAttempts).toBe(3);
    expect(backoffMs('provisioning_complete', 1)).toBe(60_000);
    expect(policyFor('access_granted').maxAttempts).toBe(1);
    expect(policyFor('something_unknown').maxAttempts).toBe(1);
  });
});
