// One-time MongoDB -> PostgreSQL (Supabase) data migration.
// Reads every collection with real data via the native Mongo driver and
// writes into the schema defined in supabase/migrations/. Uses `pg` directly
// (not supabase-js) so it only needs SUPABASE_DB_URL, not the service role key.
//
// Mongo ObjectIds are remapped to fresh UUIDs; the original id is kept in
// each table's `mongo_id` column for traceability. Run with:
//   node migration/migrate-all.mjs

import mongoose from 'mongoose';
import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config({ path: '.env.local' });

let client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
client.on('error', () => {}); // swallow async connection errors; query() below handles reconnect

async function reconnect() {
  try { await client.end(); } catch {}
  client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  client.on('error', () => {});
  await client.connect();
}

const TRANSIENT_ERRORS = ['ETIMEDOUT', 'EADDRNOTAVAIL', 'ECONNRESET', 'EPIPE', 'ENOTFOUND'];

// Every query goes through this wrapper so a mid-run network blip (this
// sandbox's connection to the pooler is intermittently flaky) reconnects
// and retries instead of killing the whole migration.
async function query(sql, values, attempt = 1) {
  try {
    return await client.query(sql, values);
  } catch (e) {
    const transient = TRANSIENT_ERRORS.includes(e.code) || /read ETIMEDOUT|EADDRNOTAVAIL|Connection terminated/.test(e.message || '');
    if (transient && attempt <= 5) {
      console.warn(`  transient connection error (${e.code || e.message}), reconnecting, attempt ${attempt}...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      await reconnect();
      return query(sql, values, attempt + 1);
    }
    throw e;
  }
}

const uuid = () => crypto.randomUUID();
const oid = (v) => (v == null ? null : String(v));
const num = (v, fallback = 0) => (v == null || Number.isNaN(Number(v)) ? fallback : Number(v));
const date = (v) => (v == null ? null : new Date(v));
const bool = (v, fallback = false) => (v == null ? fallback : Boolean(v));

// mongo _id (string) -> new postgres uuid, per entity type
const maps = {
  users: new Map(),
  stores: new Map(),
  customers: new Map(),
  inventory: new Map(),
  inventoryVariants: new Map(),
  inventoryBatches: new Map(),
  orders: new Map(),
  orderItems: new Map(),
  sales: new Map(),
  saleItems: new Map(),
  itemSales: new Map(),
  carts: new Map(),
  wishlists: new Map(),
  subscriptions: new Map(),
  services: new Map(),
  serviceItems: new Map(),
  deliverySchedules: new Map(),
};

const counts = {}; // { table: { mongo, postgres } }

async function insert(table, columns, values) {
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  await query(sql, values);
  counts[table] = counts[table] || { mongo: 0, postgres: 0 };
  counts[table].postgres++;
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  await client.connect();

  console.log('Connected to both databases. Starting migration...\n');

  // Idempotent re-run: clear all target tables first (safe, this is a
  // one-time cutover into a project this script fully owns).
  const allTables = [
    'delivery_status_history','delivery_schedule_items','delivery_schedules',
    'service_addons','service_locations','service_availability','service_items','services',
    'customer_sessions','sessions','waitlist_signups','wishlist_items','wishlists',
    'cart_items','carts','notifications',
    'item_sale_refunds','item_sale_batches','item_sales',
    'sale_item_batches','sale_items','sales',
    'order_timeline','order_stores','order_items','order_payments','order_addresses','order_customers','orders',
    'inventory_activities','inventory_batches','inventory_variants','inventory',
    'customer_addresses','customers','stores','subscriptions','users'
  ];
  for (const t of allTables) {
    await query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
  }
  console.log('Cleared all target tables. Loading fresh...\n');

  // ===================================================================
  // USERS
  // ===================================================================
  const users = await db.collection('users').find({}).toArray();
  counts.users = { mongo: users.length, postgres: 0 };
  for (const u of users) {
    const id = uuid();
    maps.users.set(oid(u._id), id);
    await insert('users', [
      'id','first_name','last_name','email','password_hash','role','is_active','last_login',
      'is_subscribed','date_subscribed','preferences','avatar','created_at','updated_at'
    ], [
      id, u.firstName || '', u.lastName || '', u.email, u.password, u.role || 'user',
      bool(u.isActive, true), date(u.lastLogin), bool(u.isSubscribed, false), date(u.dateSubscribed),
      JSON.stringify(u.preferences || {}), u.avatar || null, date(u.createdAt) || new Date(), date(u.updatedAt) || new Date()
    ]);
  }
  console.log(`users: ${users.length} migrated`);

  // ===================================================================
  // SUBSCRIPTIONS (depends on users)
  // ===================================================================
  const subs = await db.collection('subscriptions').find({}).toArray();
  counts.subscriptions = { mongo: subs.length, postgres: 0 };
  for (const s of subs) {
    const userId = maps.users.get(oid(s.userId));
    if (!userId) { console.warn(`  subscription ${s._id}: no matching user, skipped`); continue; }
    const id = uuid();
    maps.subscriptions.set(oid(s._id), id);
    await insert('subscriptions', [
      'id','user_id','plan_name','plan_type','price','currency','billing_cycle','status',
      'start_date','end_date','next_billing_date','features','created_at','updated_at'
    ], [
      id, userId, s.planName || 'Plan', s.planType === 'free' ? 'basic' : (s.planType || 'basic'),
      num(s.price?.amount, 0), s.price?.currency === 'USD' ? 'USD' : 'NGN', s.billingCycle === 'trial' ? 'monthly' : (s.billingCycle || 'monthly'),
      s.status === 'trial' ? 'active' : (s.status || 'active'), date(s.startDate) || new Date(), date(s.endDate),
      null, JSON.stringify(s.features || []), date(s.createdAt) || new Date(), date(s.updatedAt) || new Date()
    ]);
  }
  console.log(`subscriptions: ${subs.length} migrated`);

  // link users.current_subscription_id now that subscriptions exist
  for (const u of users) {
    const subId = maps.subscriptions.get(oid(u.currentSubscription));
    const userId = maps.users.get(oid(u._id));
    if (subId && userId) {
      await query('UPDATE users SET current_subscription_id = $1 WHERE id = $2', [subId, userId]);
    }
  }

  // ===================================================================
  // STORES (depends on users)
  // ===================================================================
  const stores = await db.collection('stores').find({}).toArray();
  counts.stores = { mongo: stores.length, postgres: 0 };
  for (const s of stores) {
    const ownerId = maps.users.get(oid(s.userId));
    if (!ownerId) { console.warn(`  store ${s._id}: no matching user, skipped`); continue; }
    const id = uuid();
    maps.stores.set(oid(s._id), id);
    const slug = (s.storeName || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(0, 6);
    await insert('stores', [
      'id','mongo_id','owner_id','store_name','store_slug','store_description','store_type','store_phone',
      'store_email','address','online_store_info','branding','business_hours','settings','bank_details',
      'ivma_website','is_active','is_verified','verification_status','total_sales','total_orders',
      'average_rating','total_reviews','created_at','updated_at'
    ], [
      id, oid(s._id), ownerId, s.storeName || 'Store', slug, s.storeDescription || null, s.storeType || 'physical',
      s.storePhone || null, s.storeEmail || null, JSON.stringify(s.address || {}), JSON.stringify(s.onlineStoreInfo || {}),
      JSON.stringify(s.branding || {}), JSON.stringify({}), JSON.stringify(s.settings || {}), JSON.stringify({}),
      JSON.stringify(s.ivmaWebsite || { status: 'inactive', isEnabled: false }), bool(s.isActive, true), false, 'pending',
      num(s.totalSales ?? s.totalRevenue, 0), 0, 0, 0, date(s.createdAt) || new Date(), date(s.updatedAt) || new Date()
    ]);
  }
  console.log(`stores: ${stores.length} migrated`);

  // ===================================================================
  // CUSTOMERS (+ customer_addresses)
  // ===================================================================
  const customers = await db.collection('customers').find({}).toArray();
  counts.customers = { mongo: customers.length, postgres: 0 };
  counts.customer_addresses = { mongo: 0, postgres: 0 };
  for (const c of customers) {
    const id = uuid();
    maps.customers.set(oid(c._id), id);
    await insert('customers', [
      'id','first_name','last_name','email','password_hash','phone','gender','avatar','is_verified','is_active',
      'last_login','verification_token','verification_token_expiry','password_reset_token','password_reset_expiry',
      'preferences','total_orders','total_spent','average_order_value','last_order_date','created_at','updated_at'
    ], [
      id, c.firstName || '', c.lastName || '', c.email, c.password, c.phone || null, c.gender || 'prefer-not-to-say',
      c.avatar || null, bool(c.isVerified, false), bool(c.isActive, true), date(c.lastLogin),
      c.verificationToken || null, date(c.verificationTokenExpiry), c.passwordResetToken || null, date(c.passwordResetExpiry),
      JSON.stringify(c.preferences || {}), num(c.shoppingStats?.totalOrders, 0), num(c.shoppingStats?.totalSpent, 0),
      num(c.shoppingStats?.averageOrderValue, 0), date(c.shoppingStats?.lastOrderDate),
      date(c.createdAt) || new Date(), date(c.updatedAt) || new Date()
    ]);
    for (const a of (c.addresses || [])) {
      counts.customer_addresses.mongo++;
      await insert('customer_addresses', [
        'id','customer_id','type','is_default','first_name','last_name','phone','street','city','state',
        'country','postal_code','landmark','created_at','updated_at'
      ], [
        uuid(), id, a.type || 'home', bool(a.isDefault, false), a.firstName || c.firstName || '', a.lastName || c.lastName || '',
        a.phone || c.phone || '', a.street || '', a.city || '', a.state || '', a.country || 'Nigeria',
        a.postalCode || null, a.landmark || null, new Date(), new Date()
      ]);
    }
  }
  console.log(`customers: ${customers.length} migrated (${counts.customer_addresses.postgres} addresses)`);

  // ===================================================================
  // INVENTORY (+ inventory_variants)
  // ===================================================================
  const inventories = await db.collection('inventories').find({}).toArray();
  counts.inventory = { mongo: inventories.length, postgres: 0 };
  counts.inventory_variants = { mongo: 0, postgres: 0 };
  for (const inv of inventories) {
    const id = uuid();
    maps.inventory.set(oid(inv._id), id);
    const userId = maps.users.get(oid(inv.userId));
    const storeId = [...maps.stores.entries()].length ? null : null; // resolved below once we know inventory->store mapping
    await insert('inventory', [
      'id','mongo_id','user_id','store_id','name','description','category','category_details','has_variants',
      'base_price','cost','sku','barcode','brand','unit_of_measure','stock_quantity','minimum_stock','sold_quantity',
      'images','primary_image','tags','attributes','location','supplier','is_active','web_visibility','is_deleted',
      'deleted_at','deleted_by','deletion_reason','created_at','updated_at'
    ], [
      id, oid(inv._id), userId || null, null, inv.productName || 'Unnamed', inv.description || null, inv.category || 'Other',
      JSON.stringify({}), bool(inv.hasVariants, false), num(inv.sellingPrice, 0), num(inv.costPrice, null),
      inv.sku || null, null, inv.brand || null, inv.unitOfMeasure || 'piece', num(inv.quantityInStock, 0),
      num(inv.reorderLevel, 0), num(inv.soldQuantity, 0), JSON.stringify(inv.images || []), inv.image || null,
      JSON.stringify(inv.tags || []), JSON.stringify({ notes: inv.notes || '', qrCode: inv.qrCode || '' }),
      inv.location || null, inv.supplier || null, (inv.status || 'Active').toLowerCase() === 'active',
      bool(inv.webVisibility, true), bool(inv.isDeleted, false), date(inv.deletedAt),
      maps.users.get(oid(inv.deletedBy)) || null, inv.deletionReason || null,
      date(inv.createdAt) || new Date(), date(inv.updatedAt) || new Date()
    ]);
    for (const v of (inv.variants || [])) {
      if (!v || (!v.size && !v.color)) continue;
      counts.inventory_variants.mongo++;
      const vid = uuid();
      maps.inventoryVariants.set(oid(v._id), vid);
      await insert('inventory_variants', [
        'id','inventory_id','mongo_id','size','color','sku','quantity_in_stock','reserved_quantity','reorder_level',
        'sold_quantity','price','cost_price','images','barcode','weight','is_active','created_at','updated_at'
      ], [
        vid, id, oid(v._id) || null, v.size || 'One Size', v.color || 'Default', v.sku || null,
        num(v.quantityInStock, 0), num(v.reservedQuantity, 0), num(v.reorderLevel, 5), num(v.soldQuantity, 0),
        num(v.price, null), num(v.costPrice, null), JSON.stringify(v.images || []), v.barcode || null,
        v.weight || null, bool(v.isActive, true), new Date(), new Date()
      ]);
    }
  }
  console.log(`inventory: ${inventories.length} migrated (${counts.inventory_variants.postgres} variants)`);

  // now that inventory owners are known, resolve store_id via owner's single store
  const ownerToStore = new Map();
  for (const s of stores) ownerToStore.set(oid(s.userId), maps.stores.get(oid(s._id)));
  for (const inv of inventories) {
    const invId = maps.inventory.get(oid(inv._id));
    const storeId = ownerToStore.get(oid(inv.userId));
    if (invId && storeId) await query('UPDATE inventory SET store_id = $1 WHERE id = $2', [storeId, invId]);
  }

  // ===================================================================
  // INVENTORY BATCHES
  // ===================================================================
  const batches = await db.collection('inventorybatches').find({}).toArray();
  counts.inventory_batches = { mongo: batches.length, postgres: 0 };
  const batchIdMap = new Map();
  for (const b of batches) {
    const inventoryId = maps.inventory.get(oid(b.productId));
    if (!inventoryId) { console.warn(`  batch ${b._id}: no matching inventory, skipped`); continue; }
    const id = uuid();
    batchIdMap.set(oid(b._id), id);
    await insert('inventory_batches', [
      'id','mongo_id','user_id','inventory_id','variant_id','batch_code','quantity_in','quantity_sold',
      'quantity_remaining','quantity_reserved','cost_price','selling_price','date_received','expiry_date',
      'supplier','notes','status','batch_location','archived_at','created_at','updated_at'
    ], [
      id, oid(b._id), maps.users.get(oid(b.userId)) || null, inventoryId, maps.inventoryVariants.get(oid(b.variantId)) || null,
      b.batchCode || `BATCH-${id.slice(0,8)}`, num(b.quantityIn, 0), num(b.quantitySold, 0), num(b.quantityRemaining, 0),
      num(b.quantityReserved, 0), num(b.costPrice, null), num(b.sellingPrice, null), date(b.dateReceived),
      date(b.expiryDate), b.supplier || null, b.notes || null, b.status || 'active', b.batchLocation || null,
      date(b.archivedAt), date(b.createdAt) || new Date(), date(b.updatedAt) || new Date()
    ]);
  }
  console.log(`inventory_batches: ${batches.length} migrated`);

  // ===================================================================
  // INVENTORY ACTIVITIES
  // ===================================================================
  const activities = await db.collection('inventoryactivities').find({}).toArray();
  counts.inventory_activities = { mongo: activities.length, postgres: 0 };
  for (const a of activities) {
    const inventoryId = maps.inventory.get(oid(a.inventoryId));
    if (!inventoryId) continue;
    await insert('inventory_activities', [
      'id','user_id','inventory_id','activity_type','quantity_before','quantity_changed','quantity_after',
      'reason','notes','metadata','created_at','updated_at'
    ], [
      uuid(), maps.users.get(oid(a.userId)) || null, inventoryId, a.activityType || 'updated',
      a.changes?.quantityInStock?.from ?? null, a.stockMovement?.quantity ?? null, a.changes?.quantityInStock?.to ?? null,
      a.description || a.stockMovement?.reason || null, null,
      JSON.stringify({ userAgent: a.userAgent || null, ipAddress: a.ipAddress || null }),
      date(a.createdAt) || new Date(), date(a.updatedAt) || new Date()
    ]);
  }
  console.log(`inventory_activities: ${activities.length} migrated`);

  // ===================================================================
  // ORDERS (+ order_customers, order_addresses, order_payments, order_items, order_stores, order_timeline)
  // ===================================================================
  const orders = await db.collection('orders').find({}).toArray();
  counts.orders = { mongo: orders.length, postgres: 0 };
  counts.order_items = { mongo: 0, postgres: 0 };
  counts.order_customers = { mongo: 0, postgres: 0 };
  counts.order_addresses = { mongo: 0, postgres: 0 };
  counts.order_payments = { mongo: 0, postgres: 0 };
  counts.order_stores = { mongo: 0, postgres: 0 };
  counts.order_timeline = { mongo: 0, postgres: 0 };

  for (const o of orders) {
    const id = uuid();
    maps.orders.set(oid(o._id), id);
    await insert('orders', [
      'id','mongo_id','order_number','customer_id','subtotal','tax','shipping_fee','discount','coupon_discount',
      'coupon_code','total_amount','status','fulfillment_status','customer_notes','admin_notes','order_source',
      'referral_source','tracking_carrier','tracking_number','estimated_delivery','confirmed_at','shipped_at',
      'delivered_at','cancelled_at','created_at','updated_at'
    ], [
      id, oid(o._id), o.orderNumber || `ORD-${id.slice(0,8)}`, maps.customers.get(oid(o.customer)) || null,
      num(o.subtotal, 0), num(o.tax, 0), num(o.shippingFee, 0), num(o.discount, 0), num(o.couponDiscount, 0),
      o.couponCode || null, num(o.totalAmount, 0), o.status || 'pending', 'pending', o.customerNotes || null,
      o.adminNotes || null, o.orderSource || 'web', o.referralSource || null, o.tracking?.carrier || null,
      o.tracking?.trackingNumber || null, date(o.tracking?.estimatedDelivery), null,
      date(o.tracking?.shippedAt), date(o.tracking?.deliveredAt), null,
      date(o.createdAt) || new Date(), date(o.updatedAt) || new Date()
    ]);

    if (o.customerSnapshot) {
      counts.order_customers.mongo++;
      await insert('order_customers', ['id','order_id','first_name','last_name','email','phone','created_at','updated_at'], [
        uuid(), id, o.customerSnapshot.firstName || null, o.customerSnapshot.lastName || null,
        o.customerSnapshot.email || null, o.customerSnapshot.phone || null, new Date(), new Date()
      ]);
    }
    if (o.shippingAddress) {
      counts.order_addresses.mongo++;
      const a = o.shippingAddress;
      await insert('order_addresses', [
        'id','order_id','address_type','first_name','last_name','phone','street','city','state','country',
        'postal_code','landmark','created_at','updated_at'
      ], [
        uuid(), id, 'shipping', a.firstName || null, a.lastName || null, a.phone || null, a.street || null,
        a.city || null, a.state || null, a.country || 'Nigeria', a.postalCode || null, a.landmark || null, new Date(), new Date()
      ]);
    }
    if (o.paymentInfo) {
      counts.order_payments.mongo++;
      const p = o.paymentInfo;
      await insert('order_payments', [
        'id','order_id','method','provider','transaction_id','reference','status','amount','paid_at',
        'refunded_at','refund_amount','created_at','updated_at'
      ], [
        uuid(), id, p.method || null, p.provider || 'manual', p.transactionId || null, p.reference || null,
        p.status || 'pending', num(p.amount, null), date(p.paidAt), date(p.refundedAt), num(p.refundAmount, 0),
        new Date(), new Date()
      ]);
    }
    for (const t of (o.timeline || [])) {
      counts.order_timeline.mongo++;
      await insert('order_timeline', ['id','order_id','status','note','updated_by','timestamp','created_at'], [
        uuid(), id, t.status || 'pending', t.note || null,
        ['system','customer','admin','seller'].includes(t.updatedBy) ? t.updatedBy : 'system',
        date(t.timestamp) || new Date(), new Date()
      ]);
    }
    for (const it of (o.items || [])) {
      counts.order_items.mongo++;
      const itemId = uuid();
      maps.orderItems.set(oid(it._id), itemId);
      await insert('order_items', [
        'id','mongo_id','order_id','product_id','store_id','seller_id','product_name','product_sku','product_image',
        'product_category','quantity','unit_price','subtotal','item_status','batch_id','batch_code','created_at','updated_at'
      ], [
        itemId, oid(it._id), id, maps.inventory.get(oid(it.product)) || null, maps.stores.get(oid(it.store)) || null,
        maps.users.get(oid(it.seller)) || null, it.productSnapshot?.productName || null, it.productSnapshot?.sku || null,
        it.productSnapshot?.image || null, it.productSnapshot?.category || null, num(it.quantity, 1),
        num(it.price, 0), num(it.subtotal, 0), it.itemStatus || 'pending', batchIdMap.get(oid(it.batchId)) || null,
        it.batchCode || null, date(o.createdAt) || new Date(), date(o.updatedAt) || new Date()
      ]);
      if (it.storeSnapshot) {
        counts.order_stores.mongo++;
        const ss = it.storeSnapshot;
        await insert('order_stores', [
          'id','order_item_id','store_id','store_name','store_slug','store_phone','store_email','street','city',
          'state','country','created_at','updated_at'
        ], [
          uuid(), itemId, maps.stores.get(oid(it.store)) || null, ss.storeName || null, ss.storeSlug || null,
          ss.storePhone || null, ss.storeEmail || null, ss.storeAddress?.street || null, ss.storeAddress?.city || null,
          ss.storeAddress?.state || null, ss.storeAddress?.country || 'Nigeria', new Date(), new Date()
        ]);
      }
    }
  }
  console.log(`orders: ${orders.length} migrated (${counts.order_items.postgres} items)`);

  // ===================================================================
  // SALES (+ sale_items, sale_item_batches)
  // ===================================================================
  const sales = await db.collection('sales').find({}).toArray();
  counts.sales = { mongo: sales.length, postgres: 0 };
  counts.sale_items = { mongo: 0, postgres: 0 };
  counts.sale_item_batches = { mongo: 0, postgres: 0 };
  for (const s of sales) {
    const userId = maps.users.get(oid(s.userId));
    if (!userId) { console.warn(`  sale ${s._id}: no matching user, skipped`); continue; }
    const id = uuid();
    maps.sales.set(oid(s._id), id);
    await insert('sales', [
      'id','mongo_id','user_id','transaction_id','customer_name','customer_phone','customer_email','subtotal',
      'discount','tax','total','payment_method','amount_received','balance','sale_date','status','sold_by',
      'notes','total_batches_used','total_cost_from_batches','total_profit_from_batches','average_cost_per_unit',
      'created_at','updated_at'
    ], [
      id, oid(s._id), userId, s.transactionId || `TXN-${id.slice(0,8)}`, s.customer?.name || null,
      s.customer?.phone || null, s.customer?.email || null, num(s.subtotal, 0), num(s.discount, 0), num(s.tax, 0),
      num(s.total, 0), s.paymentMethod || 'cash', num(s.amountReceived, 0), num(s.balance, 0),
      date(s.saleDate) || new Date(), s.status || 'completed', maps.users.get(oid(s.soldBy)) || userId, s.notes || null,
      num(s.batchSummary?.totalBatchesUsed, 0), num(s.batchSummary?.totalCostFromBatches, 0),
      num(s.batchSummary?.totalProfitFromBatches, 0), num(s.batchSummary?.averageCostPerUnit, 0),
      date(s.createdAt) || new Date(), date(s.updatedAt) || new Date()
    ]);
    for (const it of (s.items || [])) {
      counts.sale_items.mongo++;
      const itemId = uuid();
      maps.saleItems.set(oid(it._id), itemId);
      await insert('sale_items', [
        'id','mongo_item_id','sale_id','inventory_id','product_name','sku','quantity','unit_price','total',
        'total_cost','weighted_average_cost','profit','created_at','updated_at'
      ], [
        itemId, oid(it._id), id, maps.inventory.get(oid(it.inventoryId)) || null, it.productName || 'Item',
        it.sku || null, num(it.quantity, 1), num(it.unitPrice, 0), num(it.total, 0),
        num(it.costBreakdown?.totalCost, 0), num(it.costBreakdown?.weightedAverageCost, 0),
        num(it.costBreakdown?.profit, 0), new Date(), new Date()
      ]);
      for (const b of (it.batchesSoldFrom || [])) {
        counts.sale_item_batches.mongo++;
        await insert('sale_item_batches', [
          'id','mongo_batch_id','sale_item_id','batch_id','batch_code','quantity_from_batch','cost_price_from_batch','created_at'
        ], [
          uuid(), oid(b._id), itemId, batchIdMap.get(oid(b.batchId)) || null, b.batchCode || null,
          num(b.quantityFromBatch, 1), num(b.costPriceFromBatch, 0), new Date()
        ]);
      }
    }
  }
  console.log(`sales: ${sales.length} migrated (${counts.sale_items.postgres} line items)`);

  // ===================================================================
  // ITEM_SALES (+ item_sale_batches, item_sale_refunds) - parallel per-item analytics feed
  // ===================================================================
  const itemSales = await db.collection('itemsales').find({}).toArray();
  counts.item_sales = { mongo: itemSales.length, postgres: 0 };
  counts.item_sale_batches = { mongo: 0, postgres: 0 };
  counts.item_sale_refunds = { mongo: 0, postgres: 0 };
  for (const is of itemSales) {
    const userId = maps.users.get(oid(is.userId));
    if (!userId) { console.warn(`  itemSale ${is._id}: no matching user, skipped`); continue; }
    const id = uuid();
    maps.itemSales.set(oid(is._id), id);
    await insert('item_sales', [
      'id','mongo_id','user_id','inventory_id','sale_id','sale_transaction_id','product_name','sku','category',
      'brand','unit_of_measure','quantity_sold','unit_sale_price','total_sale_amount','unit_cost_price',
      'total_cost_amount','total_batch_cost','weighted_average_cost','batch_count','payment_method',
      'customer_name','customer_phone','customer_email','sale_date','status','sold_by','sale_location','notes',
      'created_at','updated_at'
    ], [
      id, oid(is._id), userId, maps.inventory.get(oid(is.inventoryId)) || null, maps.sales.get(oid(is.saleTransactionId)) || null,
      String(is.saleTransactionId || ''), is.itemSnapshot?.productName || 'Item', is.itemSnapshot?.sku || null,
      is.itemSnapshot?.category || null, is.itemSnapshot?.brand || null, is.itemSnapshot?.unitOfMeasure || null,
      num(is.quantitySold, 1), num(is.unitSalePrice, 0), num(is.totalSaleAmount, 0), num(is.unitCostPrice, 0),
      num(is.totalCostAmount, 0), num(is.batchCostBreakdown?.totalBatchCost, 0), num(is.batchCostBreakdown?.weightedAverageCost, 0),
      num(is.batchCostBreakdown?.batchCount, 0), is.paymentMethod || 'cash', is.customer?.name || null,
      is.customer?.phone || null, is.customer?.email || null, date(is.saleDate) || new Date(), is.status || 'completed',
      maps.users.get(oid(is.soldBy)) || userId, is.saleLocation || null, is.notes || null,
      date(is.createdAt) || new Date(), date(is.updatedAt) || new Date()
    ]);
    for (const b of (is.batchesSoldFrom || [])) {
      counts.item_sale_batches.mongo++;
      await insert('item_sale_batches', [
        'id','mongo_batch_id','item_sale_id','batch_id','batch_code','quantity_sold_from_batch',
        'unit_cost_price_from_batch','batch_date_received','batch_supplier','created_at'
      ], [
        uuid(), oid(b._id), id, batchIdMap.get(oid(b.batchId)) || null, b.batchCode || null,
        num(b.quantitySoldFromBatch, 1), num(b.unitCostPriceFromBatch, 0), date(b.batchDateReceived),
        b.batchSupplier || null, new Date()
      ]);
    }
    if (is.refundInfo?.isRefunded) {
      counts.item_sale_refunds.mongo++;
      const r = is.refundInfo;
      await insert('item_sale_refunds', [
        'id','item_sale_id','is_refunded','refund_date','refund_amount','refund_quantity','refund_reason','created_at','updated_at'
      ], [
        uuid(), id, true, date(r.refundDate), num(r.refundAmount, 0), num(r.refundQuantity, 0), r.refundReason || null,
        new Date(), new Date()
      ]);
    }
  }
  console.log(`item_sales: ${itemSales.length} migrated`);

  // ===================================================================
  // NOTIFICATIONS
  // ===================================================================
  const notifications = await db.collection('notifications').find({}).toArray();
  counts.notifications = { mongo: notifications.length, postgres: 0 };
  for (const n of notifications) {
    const userId = maps.users.get(oid(n.userId));
    if (!userId) continue;
    await insert('notifications', [
      'id','user_id','title','message','type','data','is_read','read_at','related_entity_type',
      'related_entity_id','created_at','updated_at'
    ], [
      uuid(), userId, n.title || 'Notification', n.message || '', n.type || 'info', JSON.stringify(n.data || {}),
      bool(n.isRead, false), date(n.readAt), n.relatedEntityType || null, oid(n.relatedEntityId) ? null : null,
      date(n.createdAt) || new Date(), date(n.updatedAt) || new Date()
    ]);
  }
  console.log(`notifications: ${notifications.length} migrated`);

  // ===================================================================
  // CARTS (+ cart_items)
  // ===================================================================
  const carts = await db.collection('carts').find({}).toArray();
  counts.carts = { mongo: carts.length, postgres: 0 };
  counts.cart_items = { mongo: 0, postgres: 0 };
  for (const c of carts) {
    const customerId = maps.customers.get(oid(c.customer));
    if (!customerId) { console.warn(`  cart ${c._id}: no matching customer, skipped`); continue; }
    const id = uuid();
    maps.carts.set(oid(c._id), id);
    await insert('carts', [
      'id','mongo_id','customer_id','subtotal','tax','discount','shipping','total','coupon_code','coupon_discount',
      'item_count','last_updated','expires_at','status','created_at','updated_at'
    ], [
      id, oid(c._id), customerId, num(c.subtotal, 0), num(c.tax, 0), num(c.discount, 0), num(c.shipping, 0),
      num(c.total, 0), c.couponCode || null, num(c.couponDiscount, 0), num(c.itemCount, 0),
      date(c.lastUpdated) || new Date(), date(c.expiresAt), c.status || 'active',
      date(c.createdAt) || new Date(), date(c.updatedAt) || new Date()
    ]);
    for (const it of (c.items || [])) {
      counts.cart_items.mongo++;
      const productId = maps.inventory.get(oid(it.product));
      await insert('cart_items', [
        'id','mongo_id','cart_id','product_id','store_id','product_snapshot','store_snapshot','quantity',
        'price','subtotal','notes','added_at','created_at','updated_at'
      ], [
        uuid(), oid(it._id), id, productId || null, maps.stores.get(oid(it.store)) || null,
        JSON.stringify({ ...it.productSnapshot, variant: it.variant, batch: it.batch } || {}),
        JSON.stringify(it.storeSnapshot || {}), num(it.quantity, 1), num(it.price, 0), num(it.subtotal, 0),
        it.notes || null, date(it.addedAt) || new Date(), new Date(), new Date()
      ]);
    }
  }
  console.log(`carts: ${carts.length} migrated (${counts.cart_items.postgres} items)`);

  // ===================================================================
  // WISHLISTS (+ wishlist_items) - the real product-wishlist feature
  // ===================================================================
  const wishlists = await db.collection('wishlists').find({}).toArray();
  counts.wishlists = { mongo: wishlists.length, postgres: 0 };
  counts.wishlist_items = { mongo: 0, postgres: 0 };
  const wishlistByCustomer = new Map(); // customer_id -> postgres wishlist id, merges duplicate Mongo docs
  for (const w of wishlists) {
    const customerId = maps.customers.get(oid(w.customer));
    if (!customerId) { console.warn(`  wishlist ${w._id}: no matching customer, skipped`); continue; }
    let id = wishlistByCustomer.get(customerId);
    if (!id) {
      id = uuid();
      wishlistByCustomer.set(customerId, id);
      maps.wishlists.set(oid(w._id), id);
      await insert('wishlists', [
        'id','mongo_id','customer_id','name','description','is_public','share_code','total_items','total_value',
        'view_count','last_updated','created_at','updated_at'
      ], [
        id, oid(w._id), customerId, w.name || 'My Wishlist', w.description || null, bool(w.isPublic, false),
        w.shareCode || null, num(w.stats?.totalItems, 0), num(w.stats?.totalValue, 0), num(w.stats?.viewCount, 0),
        date(w.stats?.lastUpdated) || new Date(), date(w.createdAt) || new Date(), date(w.updatedAt) || new Date()
      ]);
    } else {
      console.warn(`  wishlist ${w._id}: customer ${customerId} already has a wishlist, merging ${w.items?.length || 0} items into it`);
      maps.wishlists.set(oid(w._id), id);
    }
    for (const it of (w.items || [])) {
      counts.wishlist_items.mongo++;
      await insert('wishlist_items', [
        'id','mongo_id','wishlist_id','product_id','store_id','product_snapshot','store_snapshot','priority',
        'notes','price_drop_alert','back_in_stock_alert','target_price','added_at','created_at','updated_at'
      ], [
        uuid(), oid(it._id), id, maps.inventory.get(oid(it.product)) || null, maps.stores.get(oid(it.store)) || null,
        JSON.stringify(it.productSnapshot || {}), JSON.stringify(it.storeSnapshot || {}), it.priority || 'medium',
        it.notes || null, bool(it.priceDropAlert, true), bool(it.backInStockAlert, true), num(it.targetPrice, null),
        date(it.addedAt) || new Date(), new Date(), new Date()
      ]);
    }
  }
  console.log(`wishlists: ${wishlists.length} migrated (${counts.wishlist_items.postgres} items)`);

  // ===================================================================
  // WAITLIST SIGNUPS (unrelated marketing feature, "waitlists" collection)
  // ===================================================================
  const waitlist = await db.collection('waitlists').find({}).toArray();
  counts.waitlist_signups = { mongo: waitlist.length, postgres: 0 };
  for (const w of waitlist) {
    await insert('waitlist_signups', ['id','mongo_id','name','email','business_type','status','created_at','updated_at'], [
      uuid(), oid(w._id), w.name || '', w.email || '', w.businessType || null, w.status || 'pending',
      date(w.createdAt) || new Date(), new Date()
    ]);
  }
  console.log(`waitlist_signups: ${waitlist.length} migrated`);

  // ===================================================================
  // SESSIONS / CUSTOMER SESSIONS
  // ===================================================================
  const sessions = await db.collection('sessions').find({}).toArray();
  counts.sessions = { mongo: sessions.length, postgres: 0 };
  for (const s of sessions) {
    const userId = maps.users.get(oid(s.userId));
    if (!userId) continue;
    await insert('sessions', ['id','user_id','session_id','expires_at','data','created_at','updated_at'], [
      uuid(), userId, s.sessionId, date(s.expiresAt) || new Date(), JSON.stringify({}),
      date(s.createdAt) || new Date(), date(s.updatedAt) || new Date()
    ]);
  }
  console.log(`sessions: ${sessions.length} migrated`);

  const custSessions = await db.collection('customersessions').find({}).toArray();
  counts.customer_sessions = { mongo: custSessions.length, postgres: 0 };
  for (const s of custSessions) {
    const customerId = maps.customers.get(oid(s.customer));
    if (!customerId) continue;
    await insert('customer_sessions', [
      'id','mongo_id','customer_id','session_id','ip_address','user_agent','device','expires_at',
      'last_activity_at','is_active','logout_at','page_views','activity_log','created_at','updated_at'
    ], [
      uuid(), oid(s._id), customerId, s.sessionId, s.ipAddress || null, s.userAgent || null,
      JSON.stringify(s.device || {}), date(s.expiresAt) || new Date(), date(s.lastActivityAt) || new Date(),
      bool(s.isActive, true), date(s.logoutAt), num(s.pageViews, 0), JSON.stringify(s.activityLog || []),
      date(s.createdAt) || new Date(), date(s.updatedAt) || new Date()
    ]);
  }
  console.log(`customer_sessions: ${custSessions.length} migrated`);

  // ===================================================================
  // SERVICES (+ service_items, service_availability, service_locations, service_addons)
  // ===================================================================
  const services = await db.collection('services').find({}).toArray();
  counts.services = { mongo: services.length, postgres: 0 };
  counts.service_items = { mongo: 0, postgres: 0 };
  counts.service_availability = { mongo: 0, postgres: 0 };
  counts.service_locations = { mongo: 0, postgres: 0 };
  counts.service_addons = { mongo: 0, postgres: 0 };
  for (const svc of services) {
    const storeId = maps.stores.get(oid(svc.storeId));
    if (!storeId) { console.warn(`  service ${svc._id}: no matching store, skipped`); continue; }
    const id = uuid();
    maps.services.set(oid(svc._id), id);
    await insert('services', ['id','store_id','is_active','created_at','updated_at'], [
      id, storeId, true, date(svc.createdAt) || new Date(), date(svc.updatedAt) || new Date()
    ]);
    for (const item of (svc.services || [])) {
      counts.service_items.mongo++;
      const itemId = uuid();
      await insert('service_items', [
        'id','service_id','name','description','category','sub_category','price','duration','duration_unit',
        'years_of_experience','home_service_available','discount','time_slot_duration','max_bookings_per_day',
        'portfolio_images','is_active','created_at','updated_at'
      ], [
        itemId, id, item.name || 'Service', item.description || null, item.category || null, item.subCategory || null,
        num(item.price, 0), num(item.duration, null), item.durationUnit || 'minutes', num(item.yearsOfExperience, null),
        bool(item.homeServiceAvailable, false), num(item.discount, 0), num(item.timeSlotDuration, null),
        num(item.maxBookingsPerDay, null), JSON.stringify(item.portfolioImages || []), bool(item.isActive, true),
        new Date(), new Date()
      ]);
      for (const av of (item.availability || [])) {
        counts.service_availability.mongo++;
        await insert('service_availability', [
          'id','service_item_id','day_of_week','is_available','opening_time','closing_time','created_at'
        ], [
          uuid(), itemId, av.day, bool(av.isAvailable, true), av.openingTime || null, av.closingTime || null, new Date()
        ]);
      }
      const loc = item.serviceLocations;
      if (loc) {
        for (const st of (loc.states || [])) {
          counts.service_locations.mongo++;
          await insert('service_locations', [
            'id','service_item_id','cover_all_nigeria','state','cover_all_cities','cities','created_at'
          ], [
            uuid(), itemId, bool(loc.coverAllNigeria, false), st.state || st.name || null, bool(st.coverAllCities, false),
            JSON.stringify(st.cities || []), new Date()
          ]);
        }
        if (loc.coverAllNigeria && !(loc.states || []).length) {
          counts.service_locations.mongo++;
          await insert('service_locations', ['id','service_item_id','cover_all_nigeria','cities','created_at'], [
            uuid(), itemId, true, JSON.stringify([]), new Date()
          ]);
        }
      }
      for (const ad of (item.addOns || [])) {
        counts.service_addons.mongo++;
        await insert('service_addons', ['id','service_item_id','name','price','created_at'], [
          uuid(), itemId, ad.name || 'Add-on', num(ad.price, 0), new Date()
        ]);
      }
    }
  }
  console.log(`services: ${services.length} migrated (${counts.service_items.postgres} service items)`);

  // ===================================================================
  // DELIVERY SCHEDULES (+ delivery_schedule_items, delivery_status_history)
  // ===================================================================
  const deliveries = await db.collection('deliveryschedules').find({}).toArray();
  counts.delivery_schedules = { mongo: deliveries.length, postgres: 0 };
  counts.delivery_schedule_items = { mongo: 0, postgres: 0 };
  counts.delivery_status_history = { mongo: 0, postgres: 0 };
  for (const d of deliveries) {
    const userId = maps.users.get(oid(d.userId));
    if (!userId) { console.warn(`  delivery ${d._id}: no matching user, skipped`); continue; }
    const id = uuid();
    maps.deliverySchedules.set(oid(d._id), id);
    await insert('delivery_schedules', [
      'id','mongo_id','user_id','order_id','sale_id','transaction_id','delivery_type','customer_name',
      'customer_phone','customer_email','address_street','address_city','address_state','address_postal_code',
      'address_country','full_address','scheduled_date','time_slot','estimated_duration','delivery_fee',
      'delivery_method','delivery_notes','status','priority','assigned_to','assigned_date','delivered_at',
      'delivered_by','confirmation_recipient_name','confirmation_signature','confirmation_photo',
      'confirmation_notes','total_amount','amount_collected','payment_status','created_at','updated_at'
    ], [
      id, oid(d._id), userId, maps.orders.get(oid(d.orderId)) || null, maps.sales.get(oid(d.saleId)) || null,
      d.transactionId || null, d.deliveryType || 'order', d.customer?.name || null, d.customer?.phone || null,
      d.customer?.email || null, d.deliveryAddress?.street || null, d.deliveryAddress?.city || null,
      d.deliveryAddress?.state || null, d.deliveryAddress?.postalCode || null, d.deliveryAddress?.country || 'Nigeria',
      d.deliveryAddress?.fullAddress || null, date(d.scheduledDate), d.timeSlot || 'anytime',
      num(d.estimatedDuration, 30), num(d.deliveryFee, 0), d.deliveryMethod || 'self_delivery', d.deliveryNotes || null,
      d.status || 'scheduled', d.priority || 'medium', maps.users.get(oid(d.assignedTo)) || null, date(d.assignedDate),
      date(d.deliveredAt), maps.users.get(oid(d.deliveredBy)) || null, d.deliveryConfirmation?.recipientName || null,
      d.deliveryConfirmation?.signature || null, d.deliveryConfirmation?.photo || null, d.deliveryConfirmation?.notes || null,
      num(d.totalAmount, 0), num(d.amountCollected, 0), d.paymentStatus || 'pending',
      date(d.createdAt) || new Date(), date(d.updatedAt) || new Date()
    ]);
    for (const it of (d.items || [])) {
      counts.delivery_schedule_items.mongo++;
      await insert('delivery_schedule_items', [
        'id','mongo_item_id','delivery_schedule_id','product_name','quantity','unit_price','total','created_at'
      ], [
        uuid(), oid(it._id), id, it.productName || 'Item', num(it.quantity, 1), num(it.unitPrice, 0), num(it.total, 0), new Date()
      ]);
    }
    for (const h of (d.statusHistory || [])) {
      counts.delivery_status_history.mongo++;
      await insert('delivery_status_history', [
        'id','mongo_history_id','delivery_schedule_id','status','timestamp','updated_by','notes'
      ], [
        uuid(), oid(h._id), id, h.status || 'scheduled', date(h.timestamp) || new Date(),
        maps.users.get(oid(h.updatedBy)) || null, h.notes || null
      ]);
    }
  }
  console.log(`delivery_schedules: ${deliveries.length} migrated`);

  // ===================================================================
  // SUMMARY
  // ===================================================================
  console.log('\n=== ROW COUNT SUMMARY (mongo source docs vs postgres rows inserted) ===');
  for (const [table, c] of Object.entries(counts)) {
    const flag = c.mongo !== c.postgres ? '  <-- MISMATCH' : '';
    console.log(`${table.padEnd(28)} mongo=${String(c.mongo).padStart(4)}  postgres=${String(c.postgres).padStart(4)}${flag}`);
  }

  await mongoose.disconnect();
  await client.end();
  console.log('\nDone.');
}

run().catch(async (e) => {
  console.error('MIGRATION FAILED:', e);
  try { await client.end(); } catch {}
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
