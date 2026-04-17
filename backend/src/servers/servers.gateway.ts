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

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? '*' },
  namespace: '/servers',
})
export class ServersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ServersGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly blacklist: TokenBlacklistService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(`WS rejected (no token): ${client.id}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; iat: number; exp: number }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      // Check token blacklist (covers logged-out tokens)
      const revoked = await this.blacklist.isBlacklisted(payload.sub, payload.iat);
      if (revoked) {
        this.logger.warn(`WS rejected (revoked token): ${client.id} user=${payload.sub}`);
        client.emit('error', { message: 'Token revoked' });
        client.disconnect();
        return;
      }

      client.data.user = payload;
      this.logger.log(`WS authenticated: ${client.id} user=${payload.sub} role=${payload['role']}`);
    } catch {
      this.logger.warn(`WS rejected (invalid token): ${client.id}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected: ${client.id}`);
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

  emitAccessChanged(serverId: string, accessEnabled: boolean, expiresAt: Date | null) {
    this.server.to('servers-room').emit('server:access', { id: serverId, accessEnabled, expiresAt });
  }
}
