import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { deleteFromR2 } from "@/lib/r2";

// Same timing-safe Bearer-token check as every other cron route in this
// app (payments/cleanup-abandoned, analytics/flush).
function isAuthorized(request) {
  const auth = request.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  const authBuf = Buffer.from(auth, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (authBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(authBuf, expectedBuf);
}

const BATCH_SIZE = 200;

// This is now a BACKSTOP, not the primary deletion mechanism: the normal
// path already deletes a customer's source photo from R2 the instant
// generation finishes (see generate/route.js's deleteSourcePhotoNow), so
// a row only ever reaches this cron if that step never ran at all --
// the customer uploaded a photo and abandoned the flow before calling
// generate, or a crash happened between generation finishing and that
// delete call. Generated results need no cleanup here at all anymore --
// they're cached in Redis with their own short TTL (tryonResultKey),
// which expires on its own with no cron involvement.
export async function GET(request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('tryon_uploads')
    .select('id, r2_key')
    .lt('expires_at', new Date().toISOString())
    .is('deleted_at', null)
    .limit(BATCH_SIZE);

  if (error) {
    console.error('Error fetching expired tryon_uploads:', error);
    return NextResponse.json({ success: false, message: 'Failed to query expired uploads' }, { status: 500 });
  }

  let purged = 0;
  for (const row of rows || []) {
    try {
      if (row.r2_key) {
        await deleteFromR2(row.r2_key);
      }
      await supabaseAdmin
        .from('tryon_uploads')
        .update({ status: 'deleted', deleted_at: new Date().toISOString() })
        .eq('id', row.id);
      purged++;
    } catch (purgeError) {
      console.error(`Error purging tryon_uploads row ${row.id}:`, purgeError);
    }
  }

  return NextResponse.json({ success: true, checked: (rows || []).length, purged });
}
