import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
    const gateway = new ServersGateway({} as any, {} as any, {} as any, {} as any);
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

  // The /servers WS used to run its own copy of the token checks against the
  // Redis blacklist (fail-open). It now goes through the same
  // SessionRevocationService as HTTP, and refuses when the check can't run.
  describe('handleConnection', () => {
    function connect(assert: jest.Mock, verify: jest.Mock = jest.fn().mockReturnValue({ sub: 'user-1', sid: 'sid-1', iat: 1, exp: 2, role: 'admin' })) {
      const presence = { markOnline: jest.fn() };
      const gateway = new ServersGateway(
        { verify } as any,
        { get: jest.fn().mockReturnValue('secret') } as any,
        { assertSessionValid: assert } as any,
        presence as any,
      );
      const client: any = {
        id: 'c1',
        handshake: { auth: { token: 'tok' }, headers: {} },
        data: {},
        emit: jest.fn(),
        disconnect: jest.fn(),
      };
      return gateway.handleConnection(client).then(() => ({ client, presence }));
    }

    it('accepts a valid session', async () => {
      const { client, presence } = await connect(jest.fn().mockResolvedValue(undefined));
      expect(presence.markOnline).toHaveBeenCalledWith('user-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('rejects a revoked session', async () => {
      const { client, presence } = await connect(
        jest.fn().mockRejectedValue(new UnauthorizedException('Session has been revoked')),
      );
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Session has been revoked' });
      expect(client.disconnect).toHaveBeenCalled();
      expect(presence.markOnline).not.toHaveBeenCalled();
    });

    it('fails closed when the session check is unavailable', async () => {
      const { client, presence } = await connect(
        jest.fn().mockRejectedValue(new ServiceUnavailableException('Authorization temporarily unavailable')),
      );
      expect(client.emit).toHaveBeenCalledWith('error', {
        message: 'Authorization temporarily unavailable',
      });
      expect(client.disconnect).toHaveBeenCalled();
      expect(presence.markOnline).not.toHaveBeenCalled();
    });

    it('rejects an invalid token without consulting the session store', async () => {
      const assert = jest.fn();
      const { client } = await connect(
        assert,
        jest.fn(() => {
          throw new Error('invalid signature');
        }),
      );
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Invalid token' });
      expect(assert).not.toHaveBeenCalled();
    });
  });
});
