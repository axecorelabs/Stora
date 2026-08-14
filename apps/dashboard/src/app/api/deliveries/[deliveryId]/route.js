import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { toDeliveryResponse } from '../route';

const VALID_STATUSES = ['scheduled', 'in_progress', 'delivered', 'cancelled', 'failed'];

// PUT - Update a delivery's status
export async function PUT(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { deliveryId } = await params;
    const { status, notes } = await req.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id')
      .eq('id', deliveryId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { success: false, message: 'Delivery not found' },
        { status: 404 }
      );
    }

    const updateData = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
      updateData.delivered_by = user.id;
    }

    const { data: delivery, error: updateError } = await supabaseAdmin
      .from('delivery_schedules')
      .update(updateData)
      .eq('id', deliveryId)
      .select()
      .single();

    if (updateError || !delivery) {
      console.error('Delivery status update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update delivery status' },
        { status: 500 }
      );
    }

    await supabaseAdmin.from('delivery_status_history').insert({
      id: crypto.randomUUID(),
      delivery_schedule_id: deliveryId,
      status,
      updated_by: user.id,
      notes: notes || null
    });

    const [{ data: items }, { data: statusHistory }] = await Promise.all([
      supabaseAdmin.from('delivery_schedule_items').select('*').eq('delivery_schedule_id', deliveryId),
      supabaseAdmin.from('delivery_status_history').select('*').eq('delivery_schedule_id', deliveryId).order('timestamp', { ascending: true })
    ]);

    return NextResponse.json({
      success: true,
      message: `Delivery status updated to ${status}`,
      data: toDeliveryResponse(delivery, items, statusHistory)
    });

  } catch (error) {
    console.error('Delivery status update error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
