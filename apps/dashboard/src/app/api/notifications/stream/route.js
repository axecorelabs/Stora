import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';

// Realtime notifications relay: the browser never talks to Supabase Realtime
// directly (this app has no JWT infra to authorize that safely -- see the
// scalability plan). Instead, this route holds one service-role Postgres
// Changes subscription per connected vendor (same trust level as every other
// supabaseAdmin call in this app) and relays matching rows over
// Server-Sent Events, authorized by the existing session cookie.
export const dynamic = 'force-dynamic';

const HEARTBEAT_INTERVAL_MS = 20_000;
// Comfortably under typical serverless function duration limits -- the
// client's EventSource reconnects automatically when the stream ends, so
// this is a clean handoff, not a dropped connection.
const MAX_STREAM_DURATION_MS = 4 * 60 * 1000;

export async function GET(req) {
  const user = await verifySession(req);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();

  let channel = null;
  let heartbeatInterval = null;
  let maxDurationTimeout = null;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const enqueue = (chunk) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch (err) {
          // Controller already closed on the other end -- nothing to do.
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (channel) supabaseAdmin.removeChannel(channel);
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (maxDurationTimeout) clearTimeout(maxDurationTimeout);
        try {
          controller.close();
        } catch (err) {
          // Already closed -- fine.
        }
      };

      // `supabaseAdmin` is a module-level singleton shared by every
      // concurrent request in this process, and the realtime client caches
      // channels by name -- reusing the same name for two connections from
      // the same vendor (e.g. two open tabs) throws "cannot add
      // postgres_changes callbacks after subscribe()" on the second one.
      // Every connection gets its own channel instance.
      const channelName = `notifications-${user.id}-${crypto.randomUUID()}`;
      channel = supabaseAdmin
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            enqueue(`data: ${JSON.stringify(payload.new)}\n\n`);
          }
        )
        .subscribe();

      heartbeatInterval = setInterval(() => {
        enqueue(`: heartbeat\n\n`);
      }, HEARTBEAT_INTERVAL_MS);

      maxDurationTimeout = setTimeout(cleanup, MAX_STREAM_DURATION_MS);

      req.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      if (channel) supabaseAdmin.removeChannel(channel);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (maxDurationTimeout) clearTimeout(maxDurationTimeout);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
}
