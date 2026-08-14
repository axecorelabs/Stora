"use client";
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Opens an EventSource to the SSE relay
// (apps/dashboard/src/app/api/notifications/stream/route.js), which itself
// holds a service-role Supabase Realtime subscription filtered to this
// vendor's own notifications. Realtime is purely a "wake up and refetch"
// signal here -- on each event we just invalidate the queries that already
// know how to fetch the real data correctly, rather than trying to merge a
// raw Postgres row into client state directly.
export function useRealtimeNotifications(enabled) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;

    const eventSource = new EventSource('/api/notifications/stream');

    eventSource.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-stats'] });
    };

    eventSource.onerror = () => {
      // EventSource retries on its own with backoff -- nothing to do here.
      // (It also auto-reconnects when the relay's own max-duration timeout
      // gracefully closes the stream, which shows up as a normal error/retry.)
    };

    return () => {
      eventSource.close();
    };
  }, [enabled, queryClient]);
}
