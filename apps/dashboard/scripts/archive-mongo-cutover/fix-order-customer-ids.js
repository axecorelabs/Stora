import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixOrderCustomerIds() {
  console.log('Starting order customer_id fix...\n');

  // Step 1: Get all order_customers with their order_id and email
  const { data: orderCustomers, error: ocError } = await supabaseAdmin
    .from('order_customers')
    .select('order_id, email, first_name, last_name');

  if (ocError) {
    console.error('Error fetching order_customers:', ocError);
    return;
  }

  console.log(`Found ${orderCustomers.length} order_customers entries`);

  // Step 2: Get all customers with their id and email
  const { data: customers, error: custError } = await supabaseAdmin
    .from('customers')
    .select('id, email, first_name, last_name');

  if (custError) {
    console.error('Error fetching customers:', custError);
    return;
  }

  console.log(`Found ${customers.length} customers`);

  // Step 3: Create email -> customer_id mapping (normalize emails to lowercase)
  const emailToCustomerId = {};
  for (const customer of customers) {
    if (customer.email) {
      emailToCustomerId[customer.email.toLowerCase().trim()] = customer.id;
    }
  }

  console.log(`Email to Customer ID mapping: ${Object.keys(emailToCustomerId).length} entries\n`);

  // Step 4: Create order_id -> customer_id mapping
  const orderToCustomerId = {};
  const unmatchedEmails = [];

  for (const oc of orderCustomers) {
    if (oc.email) {
      const normalizedEmail = oc.email.toLowerCase().trim();
      const customerId = emailToCustomerId[normalizedEmail];
      
      if (customerId) {
        orderToCustomerId[oc.order_id] = customerId;
      } else {
        unmatchedEmails.push({
          order_id: oc.order_id,
          email: oc.email,
          name: `${oc.first_name || ''} ${oc.last_name || ''}`.trim()
        });
      }
    }
  }

  console.log(`Order to Customer ID mapping: ${Object.keys(orderToCustomerId).length} entries`);
  
  if (unmatchedEmails.length > 0) {
    console.log(`\nUnmatched emails (${unmatchedEmails.length}):`);
    unmatchedEmails.slice(0, 10).forEach(ue => {
      console.log(`  - Order: ${ue.order_id}, Email: ${ue.email}, Name: ${ue.name}`);
    });
    if (unmatchedEmails.length > 10) {
      console.log(`  ... and ${unmatchedEmails.length - 10} more`);
    }
  }

  // Step 5: Get orders that currently have null customer_id
  const { data: ordersWithNullCustomer, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, customer_id')
    .is('customer_id', null);

  if (ordersError) {
    console.error('Error fetching orders:', ordersError);
    return;
  }

  console.log(`\nOrders with null customer_id: ${ordersWithNullCustomer.length}`);

  // Step 6: Update orders with customer_id
  let updated = 0;
  let failed = 0;
  let noMapping = 0;

  for (const order of ordersWithNullCustomer) {
    const customerId = orderToCustomerId[order.id];
    
    if (customerId) {
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ customer_id: customerId })
        .eq('id', order.id);

      if (updateError) {
        console.error(`Failed to update order ${order.order_number}:`, updateError.message);
        failed++;
      } else {
        updated++;
      }
    } else {
      noMapping++;
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Updated: ${updated} orders`);
  console.log(`Failed: ${failed} orders`);
  console.log(`No customer mapping found: ${noMapping} orders`);

  // Step 7: Verify the fix
  const { data: remainingNull, error: verifyError } = await supabaseAdmin
    .from('orders')
    .select('id')
    .is('customer_id', null);

  if (!verifyError) {
    console.log(`\nOrders still with null customer_id: ${remainingNull.length}`);
  }

  // Show sample of updated orders
  const { data: sampleOrders } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, customer_id')
    .not('customer_id', 'is', null)
    .limit(5);

  if (sampleOrders && sampleOrders.length > 0) {
    console.log('\nSample of orders with customer_id:');
    sampleOrders.forEach(o => {
      console.log(`  Order ${o.order_number}: customer_id = ${o.customer_id}`);
    });
  }
}

fixOrderCustomerIds().catch(console.error);
