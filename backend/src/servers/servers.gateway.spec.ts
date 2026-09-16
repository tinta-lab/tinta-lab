import { ServersGateway } from './servers.gateway';

// Regression test for a real, previously-shipped functional bug (not just a
// TS mismatch): emitAccessChanged used to emit `expiresAt`, while every HTTP
// Server view and emitServerUpdate's own payload use `accessExpiresAt`.
// Frontend code merges this event with `{ ...server, ...update }` — the
// wrong field name meant that merge added a stray, unused `expiresAt` key
// and left the actually-rendered `accessExpiresAt` stale, so a live
// grant/revoke never updated the on-screen countdown. See P1.4-C.
describe('ServersGateway', () => {
  function createGateway() {
    const gateway = new ServersGateway(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    (gateway as any).server = { to };
    return { gateway, to, emit };
  }

  describe('emitAccessChanged', () => {
    it('grant: emits accessEnabled=true with accessExpiresAt, never the old expiresAt key', () => {
      const { gateway, to, emit } = createGateway();
      const expiresAt = new Date('2026-01-01T00:00:00.000Z');

      gateway.emitAccessChanged('server-1', true, expiresAt);

      expect(to).toHaveBeenCalledWith('servers-room');
      expect(emit).toHaveBeenCalledTimes(1);
      const [event, payload] = emit.mock.calls[0] as [string, unknown];
      expect(event).toBe('server:access');
      expect(payload).toEqual({
        id: 'server-1',
        accessEnabled: true,
        accessExpiresAt: expiresAt,
      });
      expect(payload).not.toHaveProperty('expiresAt');
    });

    it('revoke: emits accessEnabled=false with accessExpiresAt=null, never the old expiresAt key', () => {
      const { gateway, to, emit } = createGateway();

      gateway.emitAccessChanged('server-1', false, null);

      expect(to).toHaveBeenCalledWith('servers-room');
      const [event, payload] = emit.mock.calls[0] as [string, unknown];
      expect(event).toBe('server:access');
      expect(payload).toEqual({
        id: 'server-1',
        accessEnabled: false,
        accessExpiresAt: null,
      });
      expect(payload).not.toHaveProperty('expiresAt');
    });
  });

  describe('emitServerUpdate', () => {
    it('uses accessExpiresAt too, matching emitAccessChanged\'s naming', () => {
      const { gateway, to, emit } = createGateway();
      const payload = {
        id: 'server-1',
        status: 'online',
        accessEnabled: true,
        accessExpiresAt: new Date('2026-01-01T00:00:00.000Z'),
        lastSeenAt: new Date('2026-01-01T00:00:00.000Z'),
      };

      gateway.emitServerUpdate(payload);

      expect(to).toHaveBeenCalledWith('servers-room');
      expect(emit).toHaveBeenCalledWith('server:update', payload);
    });
  });
});
