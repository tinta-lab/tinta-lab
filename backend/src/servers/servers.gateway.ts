import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { TokenBlacklistService } from '../auth/token-blacklist.service';
import { PresenceService } from '../presence/presence.service';
import { UsersService } from '../users/users.service';

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
    private readonly blacklist: TokenBlacklistService,
    private readonly presence: PresenceService,
    private readonly usersService: UsersService,
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

    try {
      const payload = this.jwtService.verify<{
        sub: string;
        iat: number;
        exp: number;
      }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      // Check token blacklist (covers logged-out tokens)
      const revoked = await this.blacklist.isBlacklisted(
        payload.sub,
        payload.iat,
      );
      if (revoked) {
        this.logger.warn(
          `WS rejected (revoked token): ${client.id} user=${payload.sub}`,
        );
        client.emit('error', { message: 'Token revoked' });
        client.disconnect();
        return;
      }

      // Same passwordChangedAt check as JwtStrategy — a WS session shouldn't
      // outlive a password reset just because it doesn't go through Passport.
      const meta = await this.usersService.getAuthMeta(payload.sub);
      if (meta?.passwordChangedAt && payload.iat) {
        const changedAtSeconds = Math.floor(meta.passwordChangedAt.getTime() / 1000);
        if (payload.iat < changedAtSeconds) {
          this.logger.warn(
            `WS rejected (password changed since token issued): ${client.id} user=${payload.sub}`,
          );
          client.emit('error', { message: 'Token invalidated by password change' });
          client.disconnect();
          return;
        }
      }

      client.data.user = payload;
      this.presence.markOnline(payload.sub);
      this.logger.log(
        `WS authenticated: ${client.id} user=${payload.sub} role=${payload['role']}`,
      );
    } catch {
      this.logger.warn(`WS rejected (invalid token): ${client.id}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
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
  }) {
    this.server.to('servers-room').emit('server:update', payload);
  }

  emitAccessChanged(
    serverId: string,
    accessEnabled: boolean,
    expiresAt: Date | null,
  ) {
    this.server
      .to('servers-room')
      .emit('server:access', { id: serverId, accessEnabled, expiresAt });
  }
}
