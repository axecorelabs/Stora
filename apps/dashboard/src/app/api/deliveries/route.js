import { NextResponse, after } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { sendDeliveryScheduledEmail } from '@/lib/email';

// Reshape a delivery_schedules row (+ its items) back into the nested
// { customer, deliveryAddress, items, ... } shape the dashboard UI expects,
// so this rewrite doesn't require frontend changes.
export function toDeliveryResponse(delivery, items, statusHistory) {
  return {
    ...delivery,
    _id: delivery.id,
    customer: {
      name: delivery.customer_name,
      phone: delivery.customer_phone,
      email: delivery.customer_email
    },
    deliveryAddress: {
      street: delivery.address_street,
      city: delivery.address_city,
      state: delivery.address_state,
      postalCode: delivery.address_postal_code,
      country: delivery.address_country,
      fullAddress: delivery.full_address
    },
    items: (items || []).map(i => ({
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      total: i.total
    })),
    scheduledDate: delivery.scheduled_date,
    timeSlot: delivery.time_slot,
    deliveryFee: delivery.delivery_fee,
    deliveryMethod: delivery.delivery_method,
    deliveryNotes: delivery.delivery_notes,
    totalAmount: delivery.total_amount,
    paymentStatus: delivery.payment_status,
    transactionId: delivery.transaction_id,
    deliveryType: delivery.delivery_type,
    statusHistory: (statusHistory || []).map(h => ({
      status: h.status,
      timestamp: h.timestamp,
      notes: h.notes
    }))
  };
}

export async function GET(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let query = supabaseAdmin.from('delivery_schedules').select('*').eq('user_id', user.id);

    if (date) {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');
      query = query.gte('scheduled_date', startOfDay.toISOString()).lte('scheduled_date', endOfDay.toISOString());
    } else if (year && month) {
      const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
      const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59, 999));
      query = query.gte('scheduled_date', startDate.toISOString()).lte('scheduled_date', endDate.toISOString());
    } else {
      // Upcoming: scheduled, within the next 7 days
      const now = new Date();
      const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      query = query.eq('status', 'scheduled')
        .gte('scheduled_date', now.toISOString())
        .lte('scheduled_date', sevenDaysOut.toISOString());
    }

    // Defensive cap -- a per-vendor, per-day/month/upcoming-week view is
    // very unlikely to legitimately need more than this without real
    // pagination UI, which isn't built here.
    const { data: deliveries, error } = await query
      .order('scheduled_date', { ascending: true })
      .limit(500);

    if (error) {
      console.error('Delivery fetch error:', error);
      return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
    }

    const deliveryIds = (deliveries || []).map(d => d.id);
    let itemsByDelivery = {};
    let historyByDelivery = {};
    if (deliveryIds.length > 0) {
      const [{ data: items }, { data: history }] = await Promise.all([
        supabaseAdmin.from('delivery_schedule_items').select('*').in('delivery_schedule_id', deliveryIds),
        supabaseAdmin.from('delivery_status_history').select('*').in('delivery_schedule_id', deliveryIds).order('timestamp', { ascending: true })
      ]);
      (items || []).forEach(i => {
        if (!itemsByDelivery[i.delivery_schedule_id]) itemsByDelivery[i.delivery_schedule_id] = [];
        itemsByDelivery[i.delivery_schedule_id].push(i);
      });
      (history || []).forEach(h => {
        if (!historyByDelivery[h.delivery_schedule_id]) historyByDelivery[h.delivery_schedule_id] = [];
        historyByDelivery[h.delivery_schedule_id].push(h);
      });
    }

    return NextResponse.json({
      success: true,
      data: (deliveries || []).map(d => toDeliveryResponse(d, itemsByDelivery[d.id], historyByDelivery[d.id]))
    });

  } catch (error) {
    console.error('Delivery fetch error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const deliveryData = await req.json();

    const { data: sale, error: saleError } = await supabaseAdmin
      .from('sales')
      .select('*')
      .eq('id', deliveryData.saleId)
      .eq('user_id', user.id)
      .single();

    if (saleError || !sale) {
      return NextResponse.json({ success: false, message: 'Sale not found' }, { status: 404 });
    }

    const { data: saleItems } = await supabaseAdmin
      .from('sale_items')
      .select('*')
      .eq('sale_id', sale.id);

    const address = deliveryData.address || {};
    const deliveryId = crypto.randomUUID();
    const totalAmount = parseFloat(sale.total) + (Number(deliveryData.deliveryFee) || 0);

    const { data: delivery, error: insertError } = await supabaseAdmin
      .from('delivery_schedules')
      .insert({
        id: deliveryId,
        user_id: user.id,
        sale_id: sale.id,
        order_id: sale.order_id || null,
        transaction_id: sale.transaction_id,
        delivery_type: deliveryData.deliveryType || (sale.is_from_order ? 'order' : 'sale'),
        customer_name: deliveryData.customerName || sale.customer_name,
        customer_phone: deliveryData.customerPhone || sale.customer_phone,
        customer_email: deliveryData.customerEmail || sale.customer_email || '',
        address_street: address.street || null,
        address_city: address.city || null,
        address_state: address.state || null,
        address_postal_code: address.postalCode || null,
        address_country: address.country || 'Nigeria',
        full_address: address.fullAddress || null,
        scheduled_date: new Date(deliveryData.scheduledDate).toISOString(),
        time_slot: deliveryData.timeSlot || 'anytime',
        delivery_fee: Number(deliveryData.deliveryFee) || 0,
        delivery_method: deliveryData.deliveryMethod || 'self_delivery',
        delivery_notes: deliveryData.notes || '',
        priority: deliveryData.priority || 'medium',
        total_amount: totalAmount,
        payment_status: deliveryData.paymentStatus || 'paid',
        status: 'scheduled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError || !delivery) {
      console.error('Delivery creation error:', insertError);
      return NextResponse.json({ success: false, message: 'Failed to create delivery' }, { status: 500 });
    }

    const itemRows = (saleItems || []).map(item => ({
      id: crypto.randomUUID(),
      delivery_schedule_id: deliveryId,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      created_at: new Date().toISOString()
    }));
    if (itemRows.length > 0) {
      await supabaseAdmin.from('delivery_schedule_items').insert(itemRows);
    }

    await supabaseAdmin.from('delivery_status_history').insert({
      id: crypto.randomUUID(),
      delivery_schedule_id: deliveryId,
      status: 'scheduled',
      timestamp: new Date().toISOString(),
      updated_by: user.id,
      notes: `Delivery scheduled for ${deliveryData.deliveryType === 'order' ? 'order' : 'direct sale'}`
    });

    // Get store information for email
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('store_name')
      .eq('owner_id', user.id)
      .single();
    const storeName = store?.store_name || 'Stora Store';

    if (deliveryData.customerEmail) {
      // Deferred -- already fail-tolerant (caught, non-fatal), so waiting
      // on the SMTP round-trip here bought no benefit, only latency.
      after(async () => {
        try {
          await sendDeliveryScheduledEmail(
            deliveryData.customerEmail,
            deliveryData,
            {
              transactionId: sale.transaction_id,
              items: (saleItems || []).map(i => ({
                productName: i.product_name,
                quantity: i.quantity,
                unitPrice: i.unit_price,
                total: i.total
              })),
              total: sale.total,
              subtotal: sale.subtotal || sale.total
            },
            storeName
          );
        } catch (emailError) {
          console.error('Failed to send delivery notification email:', emailError);
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Delivery scheduled successfully',
      data: {
        deliveryId: delivery.id,
        transactionId: delivery.transaction_id,
        scheduledDate: delivery.scheduled_date,
        deliveryType: delivery.delivery_type,
        customer: {
          name: delivery.customer_name,
          phone: delivery.customer_phone,
          email: delivery.customer_email
        },
        items: itemRows.map(i => ({ productName: i.product_name, quantity: i.quantity, unitPrice: i.unit_price, total: i.total })),
        totalAmount: delivery.total_amount,
        status: delivery.status
      }
    });

  } catch (error) {
    console.error('Delivery creation error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
