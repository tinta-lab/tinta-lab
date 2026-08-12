'use client';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePresence } from '@/hooks/usePresence';

// Mounted once in the root layout so "online" status in the Staff page
// reflects "logged in with a tab open", not "happens to be on /dashboard/support
// or /dashboard/client right now" (sales and admin pages never opened that
// socket, so those roles always showed offline).
export default function PresenceBeacon() {
  const { user, init } = useAuth();
  useEffect(() => { init(); }, [init]);
  usePresence(!!user);
  return null;
}
