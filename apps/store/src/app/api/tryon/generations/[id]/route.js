import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyCustomerSession } from '@/lib/supabaseAuth';
import { redis, withTimeout, tryonResultKey } from '@/lib/redis';

// Polled by the client every few seconds while a generation is queued/
// processing -- see apps/store/src/app/api/tryon/generate/route.js's own
// comment on why generation happens out-of-band via after() rather than
// synchronously in that request. The result itself lives in Redis (a
// short TTL, not R2 -- see tryonResultKey's own comment), so a
// 'succeeded' row whose cache entry already expired is reported as
// failed rather than returning a broken image reference.
export async function GET(req, { params }) {
  try {
    const customerId = await verifyCustomerSession(req);
    if (!customerId) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const { data: generation, error } = await supabaseAdmin
      .from('tryon_generations')
      .select('id, status, error_message')
      .eq('id', id)
      .eq('customer_id', customerId)
      .single();

    if (error || !generation) {
      return NextResponse.json({ success: false, message: 'Generation not found' }, { status: 404 });
    }

    let resultUrl = null;
    let errorMessage = generation.status === 'failed' ? generation.error_message : null;

    if (generation.status === 'succeeded') {
      const cached = await withTimeout(redis.get(tryonResultKey(id)));
      if (cached) {
        const { data, contentType } = typeof cached === 'string' ? JSON.parse(cached) : cached;
        resultUrl = `data:${contentType};base64,${data}`;
      } else {
        errorMessage = 'This result has expired. Please try again.';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        status: resultUrl ? 'succeeded' : (generation.status === 'succeeded' ? 'failed' : generation.status),
        resultUrl,
        errorMessage
      }
    });
  } catch (error) {
    console.error('Try-on generation status error:', error);
    return NextResponse.json({ success: false, message: 'Failed to check generation status' }, { status: 500 });
  }
}
