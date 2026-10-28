// Delivery policy per notification type. Everything goes through the outbox
// (so every send is counted); what differs is how hard a failed delivery is
// retried. Backoff = wait before attempt N+1 after attempt N failed.

export type NotificationEventType =
  | 'security_anomaly'
  | 'agent_offline'
  | 'provisioning_complete'
  | 'access_granted'
  | 'access_revoked';

export interface DeliveryPolicy {
  priority: 0 | 1 | 2 | 3; // 0 critical … 3 low; claim order
  maxAttempts: number;
  backoffMinutes: number[];
}

const MIN = 1;
const HOUR = 60;

export const DELIVERY_POLICY: Record<NotificationEventType, DeliveryPolicy> = {
  // Critical: keep trying for ~a day (1+2+5+10+30m, 1+2+4+8h) before giving up.
  security_anomaly: {
    priority: 0,
    maxAttempts: 10,
    backoffMinutes: [1, 2, 5, 10, 30, HOUR, 2 * HOUR, 4 * HOUR, 8 * HOUR],
  },
  // High: technical warnings — a few hours of retries.
  agent_offline: {
    priority: 1,
    maxAttempts: 5,
    backoffMinutes: [MIN, 5, 15, HOUR],
  },
  // Normal: a lost provisioning notice is acceptable, but try briefly.
  provisioning_complete: {
    priority: 2,
    maxAttempts: 3,
    backoffMinutes: [MIN, 5],
  },
  // Low: informational — one attempt.
  access_granted: { priority: 3, maxAttempts: 1, backoffMinutes: [] },
  access_revoked: { priority: 3, maxAttempts: 1, backoffMinutes: [] },
};

export function policyFor(eventType: string): DeliveryPolicy {
  return (
    DELIVERY_POLICY[eventType as NotificationEventType] ?? {
      priority: 3,
      maxAttempts: 1,
      backoffMinutes: [],
    }
  );
}

// Delay before the next attempt once `attempts` attempts have failed.
export function backoffMs(eventType: string, attempts: number): number {
  const { backoffMinutes } = policyFor(eventType);
  if (!backoffMinutes.length) return 0;
  const minutes =
    backoffMinutes[Math.min(attempts - 1, backoffMinutes.length - 1)];
  return minutes * 60_000;
}
