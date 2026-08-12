'use client';
import { useEffect } from 'react';
import { io } from 'socket.io-client';

// Keeps a live /servers WebSocket open purely so the backend's PresenceService
// can mark this user online — separate from useServersSocket, which additionally
// subscribes to server:update/access-change events on the two dashboards that
// need them. Presence itself should track "logged in and has a tab open
// somewhere", not "happens to be on one specific page".
export function usePresence(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}/servers`, {
      withCredentials: true,
      transports: ['websocket'],
    });

    return () => {
      socket.disconnect();
    };
  }, [enabled]);
}
