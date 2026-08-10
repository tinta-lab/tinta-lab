'use client';
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Server } from '@/types';

type ServerUpdate = Pick<Server, 'id' | 'status' | 'accessEnabled' | 'accessExpiresAt' | 'lastSeenAt'>;
type AccessUpdate = Pick<Server, 'id' | 'accessEnabled' | 'accessExpiresAt'>;

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
