import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { SessionRevocationService } from '../auth/session-revocation.service';
import { PresenceService } from '../presence/presence.service';

// Parses just the one cookie we need out of a raw `Cookie` header — a full
// cookie-parsing dependency is overkill for a single httpOnly token lookup.
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

@WebSocketGateway({
  // Fail closed, not open: an unset FRONTEND_URL should refuse cross-origin
  // WS connections, not silently allow any origin (matches main.ts's REST
  // CORS, which already fails closed the same way).
  cors: { origin: process.env.FRONTEND_URL ?? false, credentials: true },
  namespace: '/servers',
})
export class ServersGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ServersGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionRevocationService,
    private readonly presence: PresenceService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      (client.handshake.headers?.authorization as string)?.replace(
        'Bearer ',
        '',
      ) ||
      readCookie(client.handshake.headers?.cookie, 'access_token');

    if (!token) {
      this.logger.warn(`WS rejected (no token): ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }

    let payload: { sub: string; sid?: string; iat: number; exp: number; role?: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      this.logger.warn(`WS rejected (invalid token): ${client.id}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
      return;
    }

    // Same session check as JwtStrategy (revoked session, inactive user,
    // token older than the last password change, no session id) — a WS
    // connection mustn't get around it just because it skips Passport. If
    // the check can't be made, refuse: never fail open.
    try {
      await this.sessions.assertSessionValid(payload);
    } catch (err) {
      const message = err instanceof HttpException ? err.message : 'Unauthorized';
      this.logger.warn(`WS rejected (${message}): ${client.id} user=${payload.sub}`);
      client.emit('error', { message });
      client.disconnect();
      return;
    }

    client.data.user = payload;
    this.presence.markOnline(payload.sub);
    this.logger.log(
      `WS authenticated: ${client.id} user=${payload.sub} role=${payload.role}`,
    );
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.user?.sub;
    if (userId) this.presence.markOffline(userId);
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  getConnectedUserIds(): Set<string> {
    return this.presence.getConnectedUserIds();
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket) {
    // user already validated in handleConnection
    client.join('servers-room');
    return { ok: true };
  }

  emitServerUpdate(payload: {
    id: string;
    status: string;
    accessEnabled: boolean;
    accessExpiresAt: Date | null;
    lastSeenAt: Date | null;
    publicStatus?: string;
    publicCheckedAt?: Date | null;
  }) {
    this.server.to('servers-room').emit('server:update', payload);
  }

  // Field named accessExpiresAt (not expiresAt) to match server:update and
  // every HTTP Server view — a naming mismatch here previously meant
  // frontend code merging this event into its server state silently kept
  // the stale accessExpiresAt (the spread added a stray, differently-named
  // `expiresAt` key instead of overwriting the one actually rendered).
  emitAccessChanged(
    serverId: string,
    accessEnabled: boolean,
    accessExpiresAt: Date | null,
  ) {
    this.server
      .to('servers-room')
      .emit('server:access', { id: serverId, accessEnabled, accessExpiresAt });
  }
}
