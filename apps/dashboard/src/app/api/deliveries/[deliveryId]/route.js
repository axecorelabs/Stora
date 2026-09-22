import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { requireCommerceApiAccess } from '@/lib/storeAccess';
import { toDeliveryResponse } from '../route';
import { validateScheduledDate, isStateDeliverable } from '@/lib/deliveryValidation';

const VALID_STATUSES = ['scheduled', 'in_progress', 'delivered', 'cancelled', 'failed'];
// Order statuses a safe, side-effect-free sync is allowed to overwrite --
// never a terminal one, and never by re-running fulfillment logic (see
// the big comment on ORDER_STATUS_BY_DELIVERY_STATUS below).
const NON_TERMINAL_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'processed', 'shipped'];
// What this delivery's status should mirror onto orders.status, when it's
// safe to. 'in_progress' has no order-status equivalent worth forcing
// (not every vendor uses "shipped" as a meaningful checkpoint), so it's
// intentionally absent here rather than added speculatively.
const ORDER_STATUS_BY_DELIVERY_STATUS = {
  delivered: 'delivered'
};

// PUT - Update a delivery's status
export async function PUT(req, { params }) {
  try {
    const access = await requireCommerceApiAccess(req);
    if (!access.ok) {
      return access.response;
    }
    const { user } = access;

    const { deliveryId } = await params;
    // status/notes: the existing status-transition path (kept exactly as
    // before). Everything else is new -- reschedule/edit, all optional --
    // so a caller changing only the date doesn't have to also resend a
    // status. status is genuinely optional now: omitting it means "edit
    // details, don't change status," which is also what makes reopening a
    // cancelled/failed delivery possible from the UI (send status:
    // 'scheduled' explicitly; VALID_STATUSES has no transition-order
    // restriction, so this already worked at the API layer -- only the
    // UI never exposed a button for it).
    const { status, notes, scheduledDate: scheduledDateInput, address, deliveryMethod, timeSlot, deliveryFee, deliveryNotes, priority } = await req.json();

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Invalid status' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('delivery_schedules')
      .select('id, status, delivery_type, order_id')
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
      updated_at: new Date().toISOString()
    };

    if (status !== undefined) {
      updateData.status = status;
      if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
        updateData.delivered_by = user.id;
      }
    }

    // Reschedule -- same validation as the original POST, so an edit
    // can't be held to a looser standard than the initial schedule.
    if (scheduledDateInput !== undefined) {
      const { date: validDate, error: dateError } = validateScheduledDate(scheduledDateInput);
      if (dateError) {
        return NextResponse.json({ success: false, message: dateError }, { status: 400 });
      }
      updateData.scheduled_date = validDate.toISOString();
    }

    // Address edit -- same deliverability check as the original POST.
    if (address !== undefined) {
      if (address.state) {
        const { data: storeForDeliveryCheck } = await supabaseAdmin
          .from('stores')
          .select('delivery_states')
          .eq('owner_id', user.id)
          .single();

        if (!isStateDeliverable(storeForDeliveryCheck?.delivery_states, address.state)) {
          return NextResponse.json({
            success: false,
            message: `Your store doesn't deliver to ${address.state}. Choose a different delivery state or update your delivery areas in Store Settings.`
          }, { status: 400 });
        }
      }
      updateData.address_street = address.street || null;
      updateData.address_city = address.city || null;
      updateData.address_state = address.state || null;
      updateData.address_postal_code = address.postalCode || null;
      updateData.address_country = address.country || 'Nigeria';
      updateData.full_address = address.fullAddress || null;
    }

    if (deliveryMethod !== undefined) updateData.delivery_method = deliveryMethod;
    if (timeSlot !== undefined) updateData.time_slot = timeSlot;
    if (deliveryFee !== undefined) updateData.delivery_fee = Number(deliveryFee) || 0;
    if (deliveryNotes !== undefined) updateData.delivery_notes = deliveryNotes;
    if (priority !== undefined) updateData.priority = priority;

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

    if (status !== undefined) {
      await supabaseAdmin.from('delivery_status_history').insert({
        id: crypto.randomUUID(),
        delivery_schedule_id: deliveryId,
        status,
        updated_by: user.id,
        notes: notes || null
      });

      // Mirror onto orders.status directly (a plain column write), never
      // by re-running /api/orders/[id]/status's own 'delivered' handling
      // -- that route deducts real stock and creates a NEW sale, meant
      // for a storefront order reaching delivery for the FIRST time. A
      // POS-processed order has already been fulfilled that way at
      // completeOrderSale's own point (its own status write there is
      // 'processed', not 'delivered') before a delivery is even
      // schedulable for it -- calling that route's logic again here would
      // double-deduct stock and record a duplicate sale. This only ever
      // updates the status label, and only forward, never onto an
      // already-terminal order.
      const nextOrderStatus = ORDER_STATUS_BY_DELIVERY_STATUS[status];
      if (nextOrderStatus && existing.delivery_type === 'order' && existing.order_id) {
        try {
          const { data: linkedOrder } = await supabaseAdmin
            .from('orders')
            .select('status')
            .eq('id', existing.order_id)
            .single();

          if (linkedOrder && NON_TERMINAL_ORDER_STATUSES.includes(linkedOrder.status)) {
            await supabaseAdmin
              .from('orders')
              .update({
                status: nextOrderStatus,
                delivered_at: nextOrderStatus === 'delivered' ? new Date().toISOString() : undefined,
                updated_at: new Date().toISOString()
              })
              .eq('id', existing.order_id);
          }
        } catch (orderSyncError) {
          console.error('Non-fatal: failed to sync order status from delivery update:', orderSyncError);
        }
      }
    }

    const [{ data: items }, { data: statusHistory }] = await Promise.all([
      supabaseAdmin.from('delivery_schedule_items').select('*').eq('delivery_schedule_id', deliveryId),
      supabaseAdmin.from('delivery_status_history').select('*').eq('delivery_schedule_id', deliveryId).order('timestamp', { ascending: true })
    ]);

    return NextResponse.json({
      success: true,
      message: status !== undefined ? `Delivery status updated to ${status}` : 'Delivery details updated',
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
