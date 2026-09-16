'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

// Transport types for the `/servers` WS namespace — deliberately NOT
// `Pick<SomeHttpView, ...>`. This event reaches both the client and support
// dashboards, which consume different HTTP views (ClientServer vs
// SupportServer); pinning it to either would wrongly couple a shared
// real-time transport to one HTTP representation. Field names/shapes here
// are taken directly from the emitting side — servers.gateway.ts's
// `emitServerUpdate`/`emitAccessChanged` — not copied from an HTTP DTO.
type ServerUpdate = {
  id: string;
  status: 'online' | 'offline' | 'unknown';
  accessEnabled: boolean;
  accessExpiresAt: string | null;
  lastSeenAt: string | null;
  publicStatus?: 'reachable' | 'unreachable' | 'unknown';
  publicCheckedAt?: string | null;
};
type AccessUpdate = {
  id: string;
  accessEnabled: boolean;
  accessExpiresAt: string | null;
};

interface Options {
  // Whether the user is logged in — the JWT itself lives only in the
  // httpOnly cookie now, so the hook has nothing sensitive to receive here.
  enabled: boolean;
  onServerUpdate: (update: ServerUpdate) => void;
  onAccessChange: (update: AccessUpdate) => void;
}

export function useServersSocket({ enabled, onServerUpdate, onAccessChange }: Options) {
  const socketRef = useRef<Socket | null>(null);
  // Stable refs ensure socket handlers always call the latest callback version
  const onServerUpdateRef = useRef(onServerUpdate);
  const onAccessChangeRef = useRef(onAccessChange);

  useEffect(() => { onServerUpdateRef.current = onServerUpdate; }, [onServerUpdate]);
  useEffect(() => { onAccessChangeRef.current = onAccessChange; }, [onAccessChange]);

  useEffect(() => {
    if (!enabled) return;

    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/servers`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe');
    });

    socket.on('server:update', (data: ServerUpdate) => {
      onServerUpdateRef.current(data);
    });

    socket.on('server:access', (data: AccessUpdate) => {
      onAccessChangeRef.current(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled]);
}
