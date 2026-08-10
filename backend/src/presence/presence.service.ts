import { Injectable } from '@nestjs/common';

// Tracks which user IDs currently have a live /servers dashboard WebSocket
// connection. Deliberately dependency-free: ServersGateway and UsersModule
// both need "who's online right now", and giving each a leaf module to
// import (instead of one importing the other's full module) avoids the
// Users↔Servers↔Auth↔Clients import cycle that a direct dependency created.
@Injectable()
export class PresenceService {
  // userId → number of live sockets (a user can have more than one tab open)
  private readonly online = new Map<string, number>();

  markOnline(userId: string): void {
    this.online.set(userId, (this.online.get(userId) ?? 0) + 1);
  }

  markOffline(userId: string): void {
    const count = (this.online.get(userId) ?? 0) - 1;
    if (count <= 0) this.online.delete(userId);
    else this.online.set(userId, count);
  }

  getConnectedUserIds(): Set<string> {
    return new Set(this.online.keys());
  }
}
