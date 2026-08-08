# Backend Build Plan — IVMA Store

## What This Document Is

A complete technical specification for building the backend server that powers the IVMA customer storefront. This backend replaces the current Next.js API routes and sits between the frontend and Supabase. The IVMA inventory management app (admin) will also consume some of these endpoints instead of calling Supabase directly.

See `backend-api-endpoints.md` for the full endpoint contracts.

---

## System Overview

```
[ ivma-store (Next.js frontend) ]
               ↓  HTTP
    [ Backend Server (Node.js) ]
               ↓  Supabase JS SDK (service role key)
         [ Supabase (PostgreSQL) ]
```

The frontend and IVMA admin app **never talk to Supabase directly**. All database access goes through the backend.

---

## Technology Stack

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node.js 20+ | LTS |
| Framework | Express or Fastify | Fastify preferred for performance; both are fine |
| Database client | `@supabase/supabase-js` (service role) | Use `supabaseAdmin` client, same as current code |
| Password hashing | `bcryptjs` | salt rounds = 12, same as current |
| Session tokens | `crypto.randomBytes(32).toString('hex')` | stored in `customer_sessions` table |
| Email | Resend or Nodemailer + SMTP | current project uses a custom `email.js` wrapper |
| Environment config | `dotenv` | |
| Validation | `zod` or `joi` | validate request bodies at the route layer |
| Deployment | Railway, Render, or Fly.io | simple Node service with env vars |

**Do not use:**
- Supabase Auth (the project uses its own custom session system)
- MongoDB / Mongoose (all data is in Supabase PostgreSQL)
- JWT tokens (uses HTTP-only cookie sessions)

---

## Database Schema

All tables live in the Supabase (PostgreSQL) project. This is the complete schema the backend reads from and writes to.

### `customers`
```sql
id                       uuid PRIMARY KEY
first_name               text NOT NULL
last_name                text NOT NULL
email                    text UNIQUE NOT NULL
phone                    text
password_hash            text NOT NULL
is_verified              boolean DEFAULT false
is_active                boolean DEFAULT true
verification_token       text          -- 6-digit code
verification_token_expiry timestamptz  -- 10 min TTL
password_reset_token     text          -- SHA-256 hash of raw token
password_reset_expiry    timestamptz   -- 15 min TTL
last_login               timestamptz
created_at               timestamptz DEFAULT now()
updated_at               timestamptz DEFAULT now()
```

### `customer_sessions`
```sql
id                uuid PRIMARY KEY
customer_id       uuid REFERENCES customers(id)
session_id        text UNIQUE NOT NULL    -- 64-char hex token stored in cookie
user_agent        text
ip_address        text
is_active         boolean DEFAULT true
expires_at        timestamptz NOT NULL    -- 7 days from creation
last_activity_at  timestamptz
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```

### `stores`
```sql
id                  uuid PRIMARY KEY
owner_id            uuid REFERENCES users(id)  -- IVMA app user
store_name          text NOT NULL
store_slug          text UNIQUE NOT NULL       -- used in storefront URL
store_description   text
store_type          text
store_phone         text
store_email         text
address             jsonb   -- { street, city, state, country, postalCode }
online_store_info   jsonb   -- { website, socialMedia: { instagram, facebook, twitter, tiktok, whatsapp } }
branding            jsonb   -- { logo, primaryColor, secondaryColor }
business_hours      jsonb
settings            jsonb
is_active           boolean DEFAULT true
is_verified         boolean DEFAULT false
average_rating      numeric(3,2)
total_reviews       integer DEFAULT 0
total_orders        integer DEFAULT 0
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

### `inventory`
```sql
id               uuid PRIMARY KEY
store_id         uuid REFERENCES stores(id)
name             text NOT NULL
sku              text
category         text
brand            text
description      text
primary_image    text
images           text[]
base_price       numeric(10,2)   -- fallback selling price (overridden by batch price)
cost             numeric(10,2)
stock_quantity   integer DEFAULT 0  -- total physical stock
quantity_reserved integer DEFAULT 0 -- sum of reservations across all active orders
sold_quantity    integer DEFAULT 0
minimum_stock    integer DEFAULT 0  -- reorder level
unit_of_measure  text
location         text
supplier         text
tags             text[]
attributes       jsonb
has_variants     boolean DEFAULT false
web_visibility   boolean DEFAULT true
is_active        boolean DEFAULT true
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()
```

Note: `available_quantity` is **not** a stored column. It is computed as:
```
available_quantity = stock_quantity - quantity_reserved
```

### `inventory_variants`
```sql
id                uuid PRIMARY KEY
inventory_id      uuid REFERENCES inventory(id)
color             text NOT NULL
size              text NOT NULL
sku               text
quantity_in_stock integer DEFAULT 0
reserved_quantity integer DEFAULT 0
sold_quantity     integer DEFAULT 0
reorder_level     integer DEFAULT 0
price             numeric(10,2)
cost_price        numeric(10,2)
images            text[]
barcode           text
weight            numeric
is_active         boolean DEFAULT true
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
UNIQUE(inventory_id, color, size)
```

### `inventory_batches`
```sql
id                uuid PRIMARY KEY
inventory_id      uuid REFERENCES inventory(id)
batch_code        text NOT NULL
quantity_in       integer NOT NULL        -- units received
quantity_sold     integer DEFAULT 0
quantity_reserved integer DEFAULT 0
cost_price        numeric(10,2)
selling_price     numeric(10,2) NOT NULL  -- this batch's selling price
date_received     date NOT NULL           -- used for FIFO ordering
expiry_date       date
supplier          text
status            text DEFAULT 'active'   -- active | depleted | expired
notes             text
created_at        timestamptz DEFAULT now()
updated_at        timestamptz DEFAULT now()
```

Available per batch = `quantity_in - quantity_sold - quantity_reserved`

### `orders`
```sql
id                  uuid PRIMARY KEY
order_number        text UNIQUE NOT NULL  -- e.g. ORD-LB4KF2A-XY7Z2
customer_id         uuid REFERENCES customers(id)
subtotal            numeric(10,2) DEFAULT 0
tax                 numeric(10,2) DEFAULT 0
shipping_fee        numeric(10,2) DEFAULT 0
discount            numeric(10,2) DEFAULT 0
coupon_discount     numeric(10,2) DEFAULT 0
total_amount        numeric(10,2) NOT NULL
status              text DEFAULT 'pending'  -- pending|confirmed|processing|shipped|delivered|cancelled
fulfillment_status  text DEFAULT 'pending'  -- pending|fulfilled|partial
customer_notes      text
admin_notes         text
order_source        text DEFAULT 'web'  -- web|pos|api
coupon_code         text
referral_source     text
confirmed_at        timestamptz
shipped_at          timestamptz
delivered_at        timestamptz
cancelled_at        timestamptz
created_at          timestamptz DEFAULT now()
updated_at          timestamptz DEFAULT now()
```

### `order_items`
```sql
id               uuid PRIMARY KEY
order_id         uuid REFERENCES orders(id)
product_id       uuid REFERENCES inventory(id)
store_id         uuid REFERENCES stores(id)
quantity         integer NOT NULL
unit_price       numeric(10,2) NOT NULL  -- price at time of order
subtotal         numeric(10,2) NOT NULL
item_status      text DEFAULT 'pending'  -- pending|fulfilled|cancelled
batch_id         uuid REFERENCES inventory_batches(id)
batch_code       text
-- product snapshot (denormalised, never changes after order)
product_name     text
product_sku      text
product_image    text
product_category text
product_brand    text
-- variant snapshot
variant_color    text
variant_size     text
variant_sku      text
variant_image    text
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()
```

### `order_addresses`
```sql
id            uuid PRIMARY KEY
order_id      uuid REFERENCES orders(id)
address_type  text NOT NULL  -- 'shipping'
first_name    text
last_name     text
phone         text
street        text
city          text
state         text
country       text DEFAULT 'Nigeria'
postal_code   text
landmark      text
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### `order_customers`
Customer snapshot at time of order (immutable).
```sql
id          uuid PRIMARY KEY
order_id    uuid REFERENCES orders(id)
first_name  text
last_name   text
email       text
phone       text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()
```

### `order_payments`
```sql
id          uuid PRIMARY KEY
order_id    uuid REFERENCES orders(id)
method      text  -- cash_to_vendor | bank_transfer | card
provider    text  -- manual | paystack | flutterwave
status      text DEFAULT 'pending'  -- pending | paid | failed | refunded
amount      numeric(10,2)
reference   text
metadata    jsonb
created_at  timestamptz DEFAULT now()
updated_at  timestamptz DEFAULT now()
```

### `order_stores`
Store snapshot per order item (immutable, captured at time of order so store changes don't affect historical orders).
```sql
id             uuid PRIMARY KEY
order_item_id  uuid REFERENCES order_items(id)
store_id       uuid
store_name     text
store_slug     text
store_phone    text
store_email    text
-- store address at time of order
street         text
city           text
state          text
country        text
postal_code    text
-- social/online presence at time of order
website        text
instagram      text
facebook       text
twitter        text
tiktok         text
whatsapp       text
-- branding
logo           text
primary_color  text
secondary_color text
created_at     timestamptz DEFAULT now()
updated_at     timestamptz DEFAULT now()
```

### `order_timeline`
```sql
id           uuid PRIMARY KEY
order_id     uuid REFERENCES orders(id)
status       text NOT NULL
from_status  text
note         text
updated_by   text  -- 'customer' | 'admin' | 'system'
timestamp    timestamptz DEFAULT now()
```

### `carts`
```sql
id            uuid PRIMARY KEY
customer_id   uuid REFERENCES customers(id) UNIQUE
subtotal      numeric(10,2) DEFAULT 0
tax           numeric(10,2) DEFAULT 0
discount      numeric(10,2) DEFAULT 0
shipping      numeric(10,2) DEFAULT 0
coupon_discount numeric(10,2) DEFAULT 0
total         numeric(10,2) DEFAULT 0
item_count    integer DEFAULT 0
status        text DEFAULT 'active'  -- active | checked_out | expired
last_updated  timestamptz
expires_at    timestamptz  -- 30 days from last update
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

### `cart_items`
```sql
id               uuid PRIMARY KEY
cart_id          uuid REFERENCES carts(id)
product_id       uuid REFERENCES inventory(id)
store_id         uuid
quantity         integer NOT NULL
price            numeric(10,2) NOT NULL  -- locked at add-to-cart time (batch price)
subtotal         numeric(10,2) NOT NULL
batch_id         uuid
batch_code       text
product_snapshot jsonb  -- { product_name, sku, primary_image, category, available_stock, variant: { variant_id, color, size } }
added_at         timestamptz DEFAULT now()
created_at       timestamptz DEFAULT now()
updated_at       timestamptz DEFAULT now()
```

### `wishlists`
```sql
id           uuid PRIMARY KEY
customer_id  uuid REFERENCES customers(id) UNIQUE
name         text DEFAULT 'My Wishlist'
description  text
is_public    boolean DEFAULT false
total_items  integer DEFAULT 0
total_value  numeric(10,2) DEFAULT 0
created_at   timestamptz DEFAULT now()
updated_at   timestamptz DEFAULT now()
```

### `wishlist_items`
```sql
id                  uuid PRIMARY KEY
wishlist_id         uuid REFERENCES wishlists(id)
product_id          uuid REFERENCES inventory(id)
priority            text DEFAULT 'medium'  -- low | medium | high
notes               text
price_drop_alert    boolean DEFAULT false
back_in_stock_alert boolean DEFAULT false
target_price        numeric(10,2)
added_at            timestamptz DEFAULT now()
```

---

## Authentication Architecture

The customer auth system is **completely separate from Supabase Auth**. Do not use `supabase.auth.*`.

### Session flow

```
1. Customer registers
   → hash password with bcrypt (salt rounds=12)
   → insert into customers (is_verified=false)
   → generate 6-digit code, store in verification_token (10 min TTL)
   → send verification email

2. Customer verifies email
   → look up customers by email + verification_token + TTL
   → set is_verified=true, clear token fields
   → CREATE SESSION (see below)
   → send welcome email

3. Customer logs in
   → find by email, verify bcrypt hash
   → if not verified: regenerate code, send email, return 403 with needsVerification:true
   → CREATE SESSION

4. CREATE SESSION
   → sessionId = crypto.randomBytes(32).toString('hex')  // 64 chars
   → insert into customer_sessions { customer_id, session_id, expires_at: now + 7 days }
   → set HTTP-only cookie: session=<sessionId>; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax
   → add Secure flag in production

5. Request authentication (every protected route)
   → parse cookie header, extract session value
   → query customer_sessions WHERE session_id=? AND is_active=true AND expires_at > now()
   → return customer_id from the joined customers row
   → if not found: return 401

6. Logout
   → set customer_sessions.is_active=false WHERE session_id=?
   → clear cookie: session=; Max-Age=0
```

### Password reset flow

```
1. POST /forgot-password
   → always return 200 (no enumeration)
   → if customer found:
     → rawToken = crypto.randomBytes(32).toString('hex')
     → store SHA-256 hash in password_reset_token
     → set password_reset_expiry = now + 15 min
     → send email with link: <BASE_URL>/reset-password?token=<rawToken>

2. POST /reset-password
   → hash incoming token with SHA-256
   → find customer WHERE password_reset_token=<hash> AND password_reset_expiry > now()
   → hash new password with bcrypt
   → update password_hash, clear reset token fields
```

---

## Stock Reservation System (FIFO)

This is the most critical business logic. It must be implemented exactly as described.

### Concepts

- `stock_quantity` — physical stock. Updated only when stock is received (batch added) or when an order is **delivered**.
- `quantity_reserved` — stock locked for pending/confirmed/shipped orders. Updated when orders are created or cancelled.
- `available_quantity` = `stock_quantity - quantity_reserved` — what customers can buy right now.
- `sold_quantity` — units that have been delivered and consumed. Updated when order is delivered.

### When an order is CREATED

Call `reserveStockFIFO(inventoryId, quantity, variantData?)` for each item:

**Simple product (no variants):**
```
1. Load inventory_batches WHERE inventory_id=? AND status='active'
   ORDER BY date_received ASC  (oldest first = FIFO)
2. For each batch, calculate: available = quantity_in - quantity_sold - quantity_reserved
3. Allocate from batches in order until quantity is fulfilled
4. For each used batch: UPDATE inventory_batches SET quantity_reserved += allocated WHERE id=?
5. UPDATE inventory SET quantity_reserved += total_quantity WHERE id=?
6. If total allocated < requested quantity: throw error (insufficient stock)
```

**Variant product:**
```
1. Load inventory_variants WHERE inventory_id=? AND color=? AND size=?
2. Check: (quantity_in_stock - reserved_quantity) >= requested quantity
3. Load inventory_batches for this inventory, FIFO order
4. Allocate batch reservations same as above
5. UPDATE inventory_variants SET reserved_quantity += quantity WHERE id=?
6. Recalculate total reserved from all variants, UPDATE inventory.quantity_reserved
```

### When an order is CANCELLED

Call `releaseOrderReservations(orderId)` for each item:
```
1. Load order_items for this order
2. For each item:
   - Load batches in FIFO order
   - Reduce quantity_reserved from batches (oldest first) until fully released
   - UPDATE inventory.quantity_reserved -= quantity
   - If variant: UPDATE inventory_variants.reserved_quantity -= quantity
     then recalculate inventory.quantity_reserved from sum of all variant reservations
```

### When an order is DELIVERED

Call `fulfillOrderReservations(orderId)` for each item:
```
1. Load order_items for this order
2. For each item:
   - Reduce quantity_reserved from batches (FIFO), AND increase quantity_sold on those batches
   - Mark batch as 'depleted' if quantity_remaining reaches 0
   - UPDATE inventory:
       quantity_reserved -= quantity
       quantity_in_stock -= quantity   (stock is now consumed)
       sold_quantity += quantity
   - If variant: same adjustments on inventory_variants, then recalculate inventory totals
```

### Batch pricing (FIFO)

The **selling price** comes from the **oldest active batch** (FIFO). This means different customers may see different prices if there are multiple batches with different prices. The price is locked at the time the item is added to the cart (`cart_items.price`).

```
current_price = first batch where (quantity_in - quantity_sold - quantity_reserved) > 0
                ordered by date_received ASC
```

---

## Order Lifecycle

```
pending → confirmed → processing → shipped → delivered
                                              ↓
                            Any state → cancelled
```

| Status | Who sets it | Stock effect |
|---|---|---|
| `pending` | System (on order creation) | Stock reserved |
| `confirmed` | Admin | No stock change |
| `processing` | Admin | No stock change |
| `shipped` | Admin | No stock change |
| `delivered` | Admin | Reserved → Sold (stock deducted) |
| `cancelled` | Customer or Admin | Reservation released |

Every status change must:
1. Update `orders.status` and the relevant timestamp column
2. Insert an `order_timeline` row

---

## Project Structure

Recommended structure for the new backend:

```
backend/
├── src/
│   ├── config/
│   │   └── supabase.js           # supabaseAdmin client (service role key)
│   ├── middleware/
│   │   ├── auth.js               # verifyCustomerSession, verifyAdminSession
│   │   └── validate.js           # zod/joi request body validation
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── products.routes.js
│   │   ├── stores.routes.js
│   │   ├── cart.routes.js
│   │   ├── orders.routes.js
│   │   ├── wishlist.routes.js
│   │   └── admin.routes.js
│   ├── services/
│   │   ├── auth.service.js       # createSession, verifySession, hashPassword...
│   │   ├── inventory.service.js  # findInventoryById, enrichWithBatches...
│   │   ├── orders.service.js     # createOrder, updateOrderStatus...
│   │   ├── cart.service.js       # getOrCreateCart, addItemToCart...
│   │   ├── wishlist.service.js
│   │   ├── stock.service.js      # reserveStockFIFO, releaseOrderReservations, fulfillOrderReservations
│   │   └── email.service.js      # sendVerificationEmail, sendWelcomeEmail, sendOrderNotification...
│   ├── utils/
│   │   ├── orderNumber.js        # generateOrderNumber()
│   │   └── cookies.js            # parseCookies()
│   └── app.js                    # server entry point
├── .env
└── package.json
```

---

## Environment Variables

```env
# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>    # never expose to frontend

# Server
PORT=3001
NODE_ENV=production
BASE_URL=https://store.ivma.ng                  # used in password reset links
FRONTEND_ORIGIN=https://store.ivma.ng           # for CORS

# Email
RESEND_API_KEY=<key>                            # or SMTP credentials
EMAIL_FROM=noreply@ivma.ng
```

---

## CORS Configuration

The backend must allow credentials (cookies) from the storefront origin:

```js
// Express example
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN,
  credentials: true,  // required for cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
```

Without `credentials: true`, the session cookie will not be sent with cross-origin requests.

---

## Email Templates Required

| Function | Trigger | Variables |
|---|---|---|
| `sendVerificationEmail` | Register, resend | `email`, `firstName`, `code` (6-digit) |
| `sendWelcomeEmail` | Email verified | `email`, `firstName` |
| `sendPasswordResetEmail` | Forgot password | `email`, `firstName`, `resetUrl`, `expiryMinutes` |
| `sendNewOrderNotification` | Order created | `storeOwnerEmail`, `orderNumber`, `items[]`, `customerName`, `totalAmount` |

All email templates are already written in `src/emails/` (JSX). The backend email service should render these or use equivalent plain-text/HTML equivalents.

---

## Order Number Format

Generated at creation time:
```js
function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();    // base-36 timestamp
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}
// Example: ORD-LB4KF2A-XY7Z2
```

---

## What to Remove / Not Port

- `src/lib/mongodb.js` — remove completely
- `src/models/*.js` (Mongoose models: Cart, Customer, CustomerSession, etc.) — all data is in Supabase
- `src/app/api/admin/fix-wishlist/` and `fix-wishlist-index/` — one-time migration scripts, do not port
- `src/app/api/orders/update-status/route.js` — duplicate of `[id]/status`, do not port
- `src/app/api/cart/add/route.js` and `src/app/api/cart/[productId]/route.js` — duplicates of the main cart POST, consolidate into one endpoint
- `src/app/api/cart/remove/route.js` — empty file
- `src/lib/auth.js` — old auth lib, replaced by `supabaseAuth.js`

---

## Implementation Order

Build in this sequence to be able to test each layer before moving on:

1. **Supabase client setup** (`config/supabase.js`) — verify connection
2. **Auth endpoints** (register, verify-email, login, logout, me, forgot-password, reset-password)
3. **Store + Product endpoints** (public, no auth required) — test with the storefront immediately
4. **Cart endpoints** (requires auth)
5. **Order create + list + detail** (requires cart working)
6. **Stock reservation** (built alongside order create)
7. **Order status update** (customer cancel)
8. **Wishlist endpoints**
9. **Admin endpoints** (order status, inventory CRUD, batch management)

---

## Security Checklist

- [ ] Never return `password_hash`, `verification_token`, or `password_reset_token` in any API response
- [ ] Always scope order queries to the authenticated `customer_id` — never trust an order ID alone
- [ ] Session tokens: use `crypto.randomBytes(32)` (256-bit entropy), never Math.random
- [ ] Password reset tokens: store SHA-256 hash in DB, only send raw token in email
- [ ] Rate limit auth endpoints (register, login, forgot-password, verify-email) — suggest `express-rate-limit`
- [ ] Set `SameSite=Strict` on session cookie in production (currently `Lax` — either is acceptable)
- [ ] Validate and sanitise all user input before passing to Supabase
- [ ] Use parameterised queries (Supabase SDK handles this automatically)
- [ ] Do not expose Supabase service role key in any client-side code
