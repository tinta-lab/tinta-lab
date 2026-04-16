import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/servers',
})
export class ServersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`WS disconnected: ${client.id}`);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket) {
    client.join('servers-room');
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
