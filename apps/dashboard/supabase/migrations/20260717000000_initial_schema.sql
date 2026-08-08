-- Stora initial schema
-- Single source of truth for the app's PostgreSQL/Supabase database.
-- Replaces MongoDB + the abandoned Sequelize model layer.
--
-- Design notes (see plan doc for full rationale):
-- - orders is a multi-vendor cart: no orders.store_id. Store scoping always goes
--   through order_items.store_id / order_stores.
-- - orders keeps normalized child tables (order_customers/order_addresses/order_payments)
--   matching the storefront's real, active checkout write path. The old JSONB-blob
--   columns some dashboard code read were never populated by live code and are dropped.
-- - sales is a POS-style transaction header with sale_items/sale_item_batches children.
--   item_sales/item_sale_batches/item_sale_refunds is a parallel per-item sales-analytics
--   feed used by inventory analytics routes (distinct, both real).
-- - services/deliveries are normalized relational tables replacing Mongo's embedded
--   document shapes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- USERS / AUTH
-- =========================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','manager')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  is_subscribed BOOLEAN DEFAULT false,
  date_subscribed TIMESTAMPTZ,
  current_subscription_id UUID,
  preferences JSONB DEFAULT '{}',
  avatar TEXT,
  is_email_verified BOOLEAN DEFAULT false,
  email_verification_token VARCHAR(255),
  email_verification_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- =========================================================================
-- STORES
-- =========================================================================

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  owner_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  store_name VARCHAR(255) NOT NULL,
  store_slug VARCHAR(255) UNIQUE,
  store_description TEXT,
  store_type VARCHAR(20) DEFAULT 'physical' CHECK (store_type IN ('physical','online','both')),
  store_phone VARCHAR(20),
  store_email VARCHAR(255),
  address JSONB DEFAULT '{}',
  online_store_info JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  business_hours JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{"allowOnlineOrders":true,"autoAcceptOrders":false,"requireCustomerVerification":false,"minOrderAmount":0,"deliveryRadius":10,"estimatedDeliveryTime":60}',
  bank_details JSONB DEFAULT '{}',
  ivma_website JSONB DEFAULT '{"status":"inactive","isEnabled":false}',
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  total_sales DECIMAL(12,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stores_store_type ON stores(store_type);
CREATE INDEX idx_stores_is_active ON stores(is_active);

-- =========================================================================
-- CUSTOMERS
-- =========================================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  date_of_birth DATE,
  gender VARCHAR(20) DEFAULT 'prefer-not-to-say' CHECK (gender IN ('male','female','other','prefer-not-to-say')),
  avatar TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  verification_token VARCHAR(255),
  verification_token_expiry TIMESTAMPTZ,
  password_reset_token VARCHAR(255),
  password_reset_expiry TIMESTAMPTZ,
  preferences JSONB DEFAULT '{"notifications":{"email":true,"sms":false,"push":true},"marketing":{"promotional_emails":true,"sms_marketing":false},"privacy":{"data_sharing":false}}',
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  average_order_value DECIMAL(12,2) DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  loyalty_points INTEGER DEFAULT 0,
  customer_tier VARCHAR(20) DEFAULT 'bronze' CHECK (customer_tier IN ('bronze','silver','gold','platinum')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_customers_is_active ON customers(is_active);
CREATE INDEX idx_customers_tier ON customers(customer_tier);

CREATE TABLE customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type VARCHAR(20) DEFAULT 'home' CHECK (type IN ('home','work','other')),
  is_default BOOLEAN DEFAULT false,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  country VARCHAR(100) DEFAULT 'Nigeria',
  postal_code VARCHAR(20),
  landmark VARCHAR(255),
  coordinates JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);

CREATE TABLE customer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(100),
  user_agent TEXT,
  device JSONB DEFAULT '{}',
  location JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  logout_at TIMESTAMPTZ,
  page_views INTEGER DEFAULT 0,
  activity_log JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_customer_sessions_customer_id ON customer_sessions(customer_id);
CREATE INDEX idx_customer_sessions_is_active ON customer_sessions(customer_id, is_active);

-- =========================================================================
-- INVENTORY
-- =========================================================================

CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  category_details JSONB DEFAULT '{}',
  has_variants BOOLEAN DEFAULT false,
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  cost DECIMAL(12,2) CHECK (cost >= 0),
  sku VARCHAR(100),
  barcode VARCHAR(100),
  brand VARCHAR(100),
  unit_of_measure VARCHAR(50) DEFAULT 'piece',
  stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
  minimum_stock INTEGER DEFAULT 0 CHECK (minimum_stock >= 0),
  sold_quantity INTEGER DEFAULT 0 CHECK (sold_quantity >= 0),
  images JSONB DEFAULT '[]',
  primary_image TEXT,
  tags JSONB DEFAULT '[]',
  attributes JSONB DEFAULT '{}',
  location VARCHAR(255),
  supplier VARCHAR(255),
  weight DECIMAL(8,3),
  dimensions JSONB,
  meta_title VARCHAR(255),
  meta_description TEXT,
  is_active BOOLEAN DEFAULT true,
  web_visibility BOOLEAN DEFAULT true,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deletion_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventory_store_id ON inventory(store_id);
CREATE INDEX idx_inventory_user_id ON inventory(user_id);
CREATE INDEX idx_inventory_sku ON inventory(sku);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_is_active ON inventory(is_active);
CREATE INDEX idx_inventory_web_visibility ON inventory(web_visibility);
CREATE INDEX idx_inventory_is_deleted ON inventory(is_deleted);
CREATE INDEX idx_inventory_store_active ON inventory(store_id, is_active);

CREATE TABLE inventory_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  mongo_id VARCHAR(100),
  size VARCHAR(50) NOT NULL DEFAULT 'One Size',
  color VARCHAR(50) NOT NULL,
  sku VARCHAR(100),
  quantity_in_stock INTEGER DEFAULT 0 CHECK (quantity_in_stock >= 0),
  reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
  reorder_level INTEGER DEFAULT 5 CHECK (reorder_level >= 0),
  sold_quantity INTEGER DEFAULT 0 CHECK (sold_quantity >= 0),
  price DECIMAL(12,2) CHECK (price >= 0),
  cost_price DECIMAL(12,2) CHECK (cost_price >= 0),
  images JSONB DEFAULT '[]',
  barcode VARCHAR(100),
  weight DECIMAL(8,3),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(inventory_id, size, color)
);
CREATE INDEX idx_inventory_variants_inventory_id ON inventory_variants(inventory_id);
CREATE INDEX idx_inventory_variants_sku ON inventory_variants(sku);
CREATE INDEX idx_inventory_variants_is_active ON inventory_variants(is_active);

CREATE TABLE inventory_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES inventory_variants(id) ON DELETE SET NULL,
  batch_code VARCHAR(100) NOT NULL,
  quantity_in INTEGER DEFAULT 0 CHECK (quantity_in >= 0),
  quantity_sold INTEGER DEFAULT 0 CHECK (quantity_sold >= 0),
  quantity_remaining INTEGER DEFAULT 0 CHECK (quantity_remaining >= 0),
  quantity_reserved INTEGER DEFAULT 0 CHECK (quantity_reserved >= 0),
  cost_price DECIMAL(12,2) CHECK (cost_price >= 0),
  selling_price DECIMAL(12,2) CHECK (selling_price >= 0),
  date_received TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  supplier VARCHAR(255),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','expired','sold_out','depleted','archived')),
  batch_location VARCHAR(255),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventory_batches_batch_code ON inventory_batches(batch_code);
CREATE INDEX idx_inventory_batches_inventory_id ON inventory_batches(inventory_id);
CREATE INDEX idx_inventory_batches_status ON inventory_batches(status);
CREATE INDEX idx_inventory_batches_inventory_status ON inventory_batches(inventory_id, status);

CREATE TABLE inventory_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  activity_type VARCHAR(30) NOT NULL CHECK (activity_type IN (
    'created','updated','stock_added','stock_removed','order_processed','price_updated',
    'status_changed','deleted','image_updated','category_changed','location_changed','batch_update'
  )),
  quantity_before INTEGER,
  quantity_changed INTEGER,
  quantity_after INTEGER,
  reason TEXT,
  notes TEXT,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  batch_code VARCHAR(100),
  related_order_id UUID,
  related_sale_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inventory_activities_inventory_created ON inventory_activities(inventory_id, created_at);
CREATE INDEX idx_inventory_activities_user_created ON inventory_activities(user_id, created_at);
CREATE INDEX idx_inventory_activities_type ON inventory_activities(activity_type);

-- =========================================================================
-- ORDERS (multi-vendor: no orders.store_id, scope via order_items.store_id)
-- =========================================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  shipping_fee DECIMAL(12,2) DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  coupon_discount DECIMAL(12,2) DEFAULT 0,
  coupon_code VARCHAR(50),
  total_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending','confirmed','processing','shipped','delivered','cancelled','refunded','failed'
  )),
  fulfillment_status VARCHAR(30) DEFAULT 'pending' CHECK (fulfillment_status IN (
    'pending','processing','partially_fulfilled','fulfilled','cancelled'
  )),
  customer_notes TEXT,
  admin_notes TEXT,
  order_source VARCHAR(20) DEFAULT 'web' CHECK (order_source IN ('web','mobile','pos','phone','email')),
  referral_source VARCHAR(255),
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE TABLE order_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  address_type VARCHAR(10) NOT NULL CHECK (address_type IN ('shipping','billing')),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  street VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Nigeria',
  postal_code VARCHAR(20),
  landmark VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_addresses_order_id ON order_addresses(order_id);

CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  method VARCHAR(20) CHECK (method IN ('card','bank_transfer','cash_to_vendor','wallet','paystack','flutterwave')),
  provider VARCHAR(20) DEFAULT 'manual' CHECK (provider IN ('paystack','flutterwave','stripe','manual')),
  transaction_id VARCHAR(255),
  reference VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded','partially_refunded')),
  amount DECIMAL(12,2) CHECK (amount >= 0),
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount DECIMAL(12,2) DEFAULT 0 CHECK (refund_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES inventory_variants(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  product_name VARCHAR(255),
  product_sku VARCHAR(100),
  product_image TEXT,
  product_category VARCHAR(100),
  product_brand VARCHAR(100),
  variant_color VARCHAR(50),
  variant_size VARCHAR(50),
  variant_sku VARCHAR(100),
  variant_image TEXT,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  item_status VARCHAR(20) DEFAULT 'pending' CHECK (item_status IN (
    'pending','confirmed','processing','shipped','delivered','cancelled','refunded','returned'
  )),
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  batch_code VARCHAR(100),
  commission_rate DECIMAL(5,4) DEFAULT 0 CHECK (commission_rate BETWEEN 0 AND 1),
  commission_amount DECIMAL(12,2) DEFAULT 0 CHECK (commission_amount >= 0),
  fulfilled_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_store_id ON order_items(store_id);
CREATE INDEX idx_order_items_seller_id ON order_items(seller_id);
CREATE INDEX idx_order_items_status ON order_items(item_status);
CREATE INDEX idx_order_items_order_store ON order_items(order_id, store_id);
CREATE INDEX idx_order_items_store_status ON order_items(store_id, item_status);

CREATE TABLE order_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  store_name VARCHAR(255),
  store_slug VARCHAR(255),
  store_phone VARCHAR(20),
  store_email VARCHAR(255),
  street VARCHAR(200),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  website VARCHAR(255),
  instagram VARCHAR(255),
  facebook VARCHAR(255),
  twitter VARCHAR(255),
  tiktok VARCHAR(255),
  whatsapp VARCHAR(255),
  logo TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_stores_store_id ON order_stores(store_id);

CREATE TABLE order_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  from_status VARCHAR(50),
  note TEXT,
  updated_by VARCHAR(20) DEFAULT 'system' CHECK (updated_by IN ('system','customer','admin','seller')),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_order_timeline_order_id ON order_timeline(order_id);
CREATE INDEX idx_order_timeline_order_timestamp ON order_timeline(order_id, "timestamp");

-- =========================================================================
-- SALES (POS transaction header + line items)
-- =========================================================================

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_number VARCHAR(50),
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  transaction_id VARCHAR(100) NOT NULL UNIQUE,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash','transfer','card','credit','pos','other')),
  amount_received DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled','refunded','partially_refunded')),
  sold_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  is_from_order BOOLEAN DEFAULT false,
  total_batches_used INTEGER DEFAULT 0,
  total_cost_from_batches DECIMAL(12,2) DEFAULT 0,
  total_profit_from_batches DECIMAL(12,2) DEFAULT 0,
  average_cost_per_unit DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_order_id ON sales(order_id);
CREATE INDEX idx_sales_store_id ON sales(store_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_sale_date ON sales(sale_date);

CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_item_id VARCHAR(50),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  weighted_average_cost DECIMAL(10,2) DEFAULT 0,
  profit DECIMAL(10,2) DEFAULT 0,
  variant_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX idx_sale_items_inventory_id ON sale_items(inventory_id);

CREATE TABLE sale_item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_batch_id VARCHAR(50),
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  batch_code VARCHAR(100),
  quantity_from_batch INTEGER DEFAULT 1,
  cost_price_from_batch DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_sale_item_batches_sale_item_id ON sale_item_batches(sale_item_id);

-- item_sales: parallel per-item sales-analytics feed (distinct from sales/sale_items,
-- both confirmed live). Populated whenever a sale_item is created.
CREATE TABLE item_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  sale_transaction_id VARCHAR(100),
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  primary_batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  brand VARCHAR(100),
  unit_of_measure VARCHAR(50),
  quantity_sold INTEGER NOT NULL DEFAULT 1,
  unit_sale_price DECIMAL(10,2) DEFAULT 0,
  total_sale_amount DECIMAL(10,2) DEFAULT 0,
  unit_cost_price DECIMAL(10,2) DEFAULT 0,
  total_cost_amount DECIMAL(10,2) DEFAULT 0,
  total_batch_cost DECIMAL(10,2) DEFAULT 0,
  weighted_average_cost DECIMAL(10,2) DEFAULT 0,
  batch_count INTEGER DEFAULT 0,
  payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash','transfer','card','credit','pos','other')),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled','refunded','partially_refunded')),
  sold_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sale_location VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_item_sales_user_id ON item_sales(user_id);
CREATE INDEX idx_item_sales_inventory_id ON item_sales(inventory_id);
CREATE INDEX idx_item_sales_sale_id ON item_sales(sale_id);
CREATE INDEX idx_item_sales_status ON item_sales(status);
CREATE INDEX idx_item_sales_sale_date ON item_sales(sale_date);

CREATE TABLE item_sale_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_batch_id VARCHAR(50),
  item_sale_id UUID NOT NULL REFERENCES item_sales(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES inventory_batches(id) ON DELETE SET NULL,
  batch_code VARCHAR(100),
  quantity_sold_from_batch INTEGER DEFAULT 1,
  unit_cost_price_from_batch DECIMAL(10,2) DEFAULT 0,
  batch_date_received TIMESTAMPTZ,
  batch_supplier VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_item_sale_batches_item_sale_id ON item_sale_batches(item_sale_id);

CREATE TABLE item_sale_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_sale_id UUID NOT NULL UNIQUE REFERENCES item_sales(id) ON DELETE CASCADE,
  is_refunded BOOLEAN DEFAULT false,
  refund_date TIMESTAMPTZ,
  refund_amount DECIMAL(10,2) DEFAULT 0,
  refund_quantity INTEGER DEFAULT 0,
  refund_reason TEXT,
  refunded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- NOTIFICATIONS
-- =========================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (type IN (
    'order','payment','inventory','promotion','system','security','reminder','announcement','info'
  )),
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  category VARCHAR(50),
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  channels JSONB DEFAULT '["in_app"]',
  delivery_status JSONB DEFAULT '{}',
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  actions JSONB DEFAULT '[]',
  click_count INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN (
    'order','payment','inventory','promotion','system','security','reminder','announcement'
  )),
  category VARCHAR(50),
  title_template VARCHAR(255) NOT NULL,
  message_template TEXT NOT NULL,
  channels JSONB DEFAULT '["in_app"]',
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  is_active BOOLEAN DEFAULT true,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- CARTS / WISHLISTS (storefront)
-- =========================================================================

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  subtotal DECIMAL(12,2) DEFAULT 0 CHECK (subtotal >= 0),
  tax DECIMAL(12,2) DEFAULT 0 CHECK (tax >= 0),
  discount DECIMAL(12,2) DEFAULT 0 CHECK (discount >= 0),
  shipping DECIMAL(12,2) DEFAULT 0 CHECK (shipping >= 0),
  total DECIMAL(12,2) DEFAULT 0 CHECK (total >= 0),
  coupon_code VARCHAR(100),
  coupon_discount DECIMAL(12,2) DEFAULT 0 CHECK (coupon_discount >= 0),
  item_count INTEGER DEFAULT 0 CHECK (item_count >= 0),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','abandoned','converted','expired')),
  session_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_carts_status ON carts(status);
CREATE INDEX idx_carts_session_id ON carts(session_id);

CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  product_snapshot JSONB DEFAULT '{}',
  store_snapshot JSONB DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  subtotal DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, product_id)
);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  customer_id UUID NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  name VARCHAR(100) DEFAULT 'My Wishlist',
  description VARCHAR(500),
  is_public BOOLEAN DEFAULT false,
  share_code VARCHAR(20) UNIQUE,
  total_items INTEGER DEFAULT 0,
  total_value DECIMAL(12,2) DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50),
  wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  product_snapshot JSONB DEFAULT '{}',
  store_snapshot JSONB DEFAULT '{}',
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  notes VARCHAR(500),
  price_drop_alert BOOLEAN DEFAULT true,
  back_in_stock_alert BOOLEAN DEFAULT true,
  target_price DECIMAL(12,2),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wishlist_id, product_id)
);
CREATE INDEX idx_wishlist_items_wishlist_id ON wishlist_items(wishlist_id);

-- =========================================================================
-- SUBSCRIPTIONS / TEMP USERS
-- =========================================================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name VARCHAR(100) NOT NULL,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('basic','premium','enterprise')),
  price DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'NGN',
  billing_cycle VARCHAR(10) NOT NULL CHECK (billing_cycle IN ('monthly','quarterly','yearly')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','cancelled','expired','paused')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  next_billing_date TIMESTAMPTZ,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

ALTER TABLE users ADD CONSTRAINT fk_users_current_subscription
  FOREIGN KEY (current_subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;

CREATE TABLE temp_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  verification_code_expires TIMESTAMPTZ NOT NULL,
  resend_count INTEGER DEFAULT 0,
  last_resend_at TIMESTAMPTZ,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- SERVICES (normalized, replaces Mongo embedded-array Service document)
-- =========================================================================

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  sub_category VARCHAR(100),
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  duration INTEGER,
  duration_unit VARCHAR(10) DEFAULT 'minutes' CHECK (duration_unit IN ('minutes','hours','days')),
  years_of_experience INTEGER,
  home_service_available BOOLEAN DEFAULT false,
  discount DECIMAL(5,2) DEFAULT 0,
  time_slot_duration INTEGER,
  max_bookings_per_day INTEGER,
  portfolio_images JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_service_items_service_id ON service_items(service_id);
CREATE INDEX idx_service_items_category ON service_items(category);

CREATE TABLE service_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_item_id UUID NOT NULL REFERENCES service_items(id) ON DELETE CASCADE,
  day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  is_available BOOLEAN DEFAULT true,
  opening_time TIME,
  closing_time TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_item_id, day_of_week)
);

CREATE TABLE service_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_item_id UUID NOT NULL REFERENCES service_items(id) ON DELETE CASCADE,
  cover_all_nigeria BOOLEAN DEFAULT false,
  state VARCHAR(100),
  cover_all_cities BOOLEAN DEFAULT false,
  cities JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_service_locations_service_item_id ON service_locations(service_item_id);

CREATE TABLE service_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_item_id UUID NOT NULL REFERENCES service_items(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_service_addons_service_item_id ON service_addons(service_item_id);

-- =========================================================================
-- DELIVERIES
-- =========================================================================

-- Per-order/per-sale delivery instance (what the dashboard deliveries feature tracks)
CREATE TABLE delivery_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_id VARCHAR(50) UNIQUE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  transaction_id VARCHAR(100),
  delivery_type VARCHAR(10) DEFAULT 'order' CHECK (delivery_type IN ('order','sale','custom')),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(100),
  full_address TEXT,
  scheduled_date TIMESTAMPTZ,
  time_slot VARCHAR(50) DEFAULT 'anytime',
  estimated_duration INTEGER DEFAULT 30,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  delivery_method VARCHAR(20) DEFAULT 'self_delivery' CHECK (delivery_method IN ('self_delivery','third_party','pickup','courier')),
  delivery_notes TEXT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','delivered','cancelled','failed')),
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_date TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES users(id) ON DELETE SET NULL,
  confirmation_recipient_name VARCHAR(255),
  confirmation_signature TEXT,
  confirmation_photo TEXT,
  confirmation_notes TEXT,
  total_amount DECIMAL(10,2) DEFAULT 0,
  amount_collected DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','partially_paid','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_delivery_schedules_user_id ON delivery_schedules(user_id);
CREATE INDEX idx_delivery_schedules_order_id ON delivery_schedules(order_id);
CREATE INDEX idx_delivery_schedules_status ON delivery_schedules(status);
CREATE INDEX idx_delivery_schedules_scheduled_date ON delivery_schedules(scheduled_date);
CREATE INDEX idx_delivery_schedules_assigned_to ON delivery_schedules(assigned_to);

CREATE TABLE delivery_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_item_id VARCHAR(50),
  delivery_schedule_id UUID NOT NULL REFERENCES delivery_schedules(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_delivery_schedule_items_schedule_id ON delivery_schedule_items(delivery_schedule_id);

CREATE TABLE delivery_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mongo_history_id VARCHAR(50),
  delivery_schedule_id UUID NOT NULL REFERENCES delivery_schedules(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('scheduled','in_progress','delivered','cancelled','failed')),
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);
CREATE INDEX idx_delivery_status_history_schedule_id ON delivery_status_history(delivery_schedule_id);

-- Store-level recurring delivery template/config (distinct concept, distinct table
-- name to avoid the collision the old schema file had with delivery_schedules).
CREATE TABLE delivery_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  schedule_name VARCHAR(255) NOT NULL,
  delivery_days JSONB NOT NULL DEFAULT '[]',
  delivery_time_slots JSONB NOT NULL DEFAULT '{}',
  delivery_areas JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_delivery_configurations_store_id ON delivery_configurations(store_id);

-- =========================================================================
-- RLS: enabled with no policies, matching the app's existing convention.
-- Every server-side route uses the service-role client (bypasses RLS by
-- design); this just ensures no anon/authenticated-role client can read
-- these tables directly without an explicit policy being added later.
-- =========================================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- =========================================================================
-- updated_at triggers (only for tables that have the column)
-- =========================================================================

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()',
      t, t
    );
  END LOOP;
END $$;
