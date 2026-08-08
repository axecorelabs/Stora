# Backend API Endpoints — IVMA Store

## Overview

This document covers every API endpoint for the IVMA customer storefront. All endpoints are derived from the existing Next.js routes and must be replicated exactly in the new backend server.

Supabase is the **source of truth**. The backend server connects to Supabase using the service role key and handles all business logic before writing to the database.

---

## Authentication Model

The backend uses **custom session-based authentication with HTTP-only cookies** — not Supabase Auth, not JWTs.

- On login/register/verify-email, the server creates a row in `customer_sessions` and sets a `session` cookie.
- Every protected endpoint reads the `session` cookie, looks up the session in `customer_sessions`, and returns the `customer_id`.
- Sessions expire after **7 days**. The `expires_at` column is checked on every request.
- Cookies are set as: `HttpOnly; Path=/; SameSite=Lax; Secure` (Secure only in production).

---

## Standard Response Format

**Success:**
```json
{ "success": true, "<resource>": { ... } }
```

**Error:**
```json
{ "success": false, "message": "Human-readable error message" }
```

HTTP status codes must be consistent:
- `200` — OK
- `201` — Created
- `400` — Bad request / validation failure
- `401` — Not authenticated (no/invalid session)
- `403` — Authenticated but not authorized (e.g. email not verified)
- `404` — Resource not found
- `409` — Conflict (e.g. email already registered)
- `500` — Internal server error

---

## 1. Authentication — `/api/auth/customer`

### `POST /api/auth/customer/register`
Register a new customer account. Does **not** log them in. Sends a 6-digit verification code to their email.

**Auth required:** No

**Request body:**
```json
{
  "firstName": "string (required)",
  "lastName": "string (required)",
  "email": "string (required, unique)",
  "phone": "string (optional)",
  "password": "string (required)",
  "agreeToTerms": "boolean (required, must be true)"
}
```

**Success `201`:**
```json
{
  "success": true,
  "message": "Account created successfully. Please check your email for verification code.",
  "customer": { "email": "string" }
}
```

**Errors:**
- `400` — Missing required fields or `agreeToTerms` is false
- `409` — Email already registered

**Side effects:**
- Creates row in `customers` table with `is_verified: false`
- Stores 6-digit `verification_token` + `verification_token_expiry` (10 min TTL)
- Sends verification email via email service

---

### `POST /api/auth/customer/login`
Authenticate with email + password. Returns session cookie. If email is unverified, sends a fresh verification code and returns `403`.

**Auth required:** No

**Request body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "Login successful",
  "customer": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string | null",
    "isVerified": true,
    "createdAt": "ISO 8601"
  }
}
```
Sets `Set-Cookie: session=<token>; HttpOnly; ...`

**Errors:**
- `400` — Missing fields
- `401` — Invalid email or password
- `403` — Email not verified — response includes `"needsVerification": true`

**Side effects:**
- Creates row in `customer_sessions`
- Updates `last_login` on the customer record
- If unverified: regenerates verification code, sends verification email

---

### `POST /api/auth/customer/logout`
Invalidates the session and clears the cookie.

**Auth required:** No (gracefully handles missing session)

**Request body:** None

**Success `200`:**
```json
{ "success": true, "message": "Logged out successfully" }
```

**Side effects:**
- Sets `is_active: false` on the `customer_sessions` row
- Clears `session` cookie (`Max-Age=0`)

---

### `GET /api/auth/customer/me`
Return the currently authenticated customer's profile.

**Auth required:** Yes

**Success `200`:**
```json
{
  "success": true,
  "customer": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string | null",
    "isVerified": true,
    "createdAt": "ISO 8601"
  }
}
```

**Errors:**
- `401` — No valid session
- `404` — Customer row not found (should not happen in practice)

---

### `POST /api/auth/customer/verify-email`
Verify email with the 6-digit code that was sent after registration. Logs the customer in immediately on success (creates a session).

**Auth required:** No

**Request body:**
```json
{
  "email": "string (required)",
  "code": "string (required, 6-digit)"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "customer": { "id": "uuid", "email": "string", "firstName": "string", ... }
}
```
Sets session cookie.

**Errors:**
- `400` — Invalid or expired code

**Side effects:**
- Sets `is_verified: true`, clears `verification_token` and `verification_token_expiry`
- Creates row in `customer_sessions`
- Sends welcome email

---

### `POST /api/auth/customer/resend-verification`
Resend the 6-digit verification code to the customer's email.

**Auth required:** No

**Request body:**
```json
{
  "email": "string (required)"
}
```

**Success `200`:**
```json
{ "success": true, "message": "Verification code sent" }
```

**Errors:**
- `400` — Email not provided or not found
- `400` — Account already verified

**Side effects:**
- Generates new 6-digit code, updates `verification_token` + expiry (10 min)
- Sends verification email

---

### `POST /api/auth/customer/forgot-password`
Request a password reset link. Always returns `200` even if the email doesn't exist (security best practice — no user enumeration).

**Auth required:** No

**Request body:**
```json
{
  "email": "string (required)"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "If an account exists with this email, you will receive a password reset link shortly."
}
```

**Side effects (only if email exists):**
- Generates a `crypto.randomBytes(32)` token, stores its SHA-256 hash in `password_reset_token`
- Sets `password_reset_expiry` to 15 minutes from now
- Sends reset email with URL: `<BASE_URL>/reset-password?token=<raw_token>`

---

### `POST /api/auth/customer/reset-password`
Complete a password reset using the token from the reset email.

**Auth required:** No

**Request body:**
```json
{
  "token": "string (required, raw token from email URL)",
  "password": "string (required, min 8 characters)"
}
```

**Success `200`:**
```json
{ "success": true, "message": "Password reset successfully" }
```

**Errors:**
- `400` — Missing fields, password too short, or token invalid/expired

**Side effects:**
- Hashes new password, updates `password_hash`
- Clears `password_reset_token` and `password_reset_expiry`

---

## 2. Products — `/api/products`

### `GET /api/products/:id`
Fetch a single product by inventory ID. Returns FIFO batch-based pricing and full availability data.

**Auth required:** No

**URL params:** `id` — inventory UUID

**Success `200`:**
```json
{
  "success": true,
  "product": {
    "id": "uuid",
    "productName": "string",
    "sku": "string",
    "category": "string",
    "brand": "string",
    "description": "string",
    "image": "string (URL)",
    "images": ["string"],
    "sellingPrice": "number (from current FIFO batch)",
    "quantityInStock": "number (total available across all active batches)",
    "quantityReserved": "number",
    "availableQuantity": "number",
    "hasVariants": "boolean",
    "variants": [
      {
        "id": "uuid",
        "color": "string",
        "size": "string",
        "sku": "string",
        "quantityInStock": "number",
        "quantityReserved": "number",
        "availableQuantity": "number",
        "price": "number"
      }
    ],
    "batches": [
      {
        "id": "uuid",
        "batchCode": "string",
        "quantityRemaining": "number",
        "sellingPrice": "number",
        "dateReceived": "ISO 8601",
        "expiryDate": "ISO 8601 | null",
        "isCurrentBatch": "boolean"
      }
    ],
    "batchInfo": {
      "hasBatches": "boolean",
      "totalBatches": "number",
      "currentBatchId": "uuid | null",
      "currentBatchCode": "string | null",
      "priceRange": { "min": "number", "max": "number" },
      "methodology": "FIFO - First In, First Out (oldest batches sold first)"
    },
    "storeId": "uuid",
    "isActive": "boolean",
    "webVisibility": "boolean",
    "store": { "id": "uuid", "storeName": "string", "storeSlug": "string" }
  }
}
```

**Errors:**
- `404` — Product not found or `is_active` is false
- `404` — Associated store not found

---

## 3. Stores — `/api/store` and `/api/stores`

### `GET /api/store/:slug`
Fetch a store by its `store_slug` along with all its active products. Used by the storefront landing page.

**Auth required:** No

**URL params:** `slug` — store slug string

**Success `200`:**
```json
{
  "id": "uuid",
  "storeName": "string",
  "storeSlug": "string",
  "storeDescription": "string",
  "storePhone": "string",
  "storeEmail": "string",
  "address": { "street": "string", "city": "string", "state": "string", "country": "string" },
  "branding": { "logo": "string (URL)", "primaryColor": "string", "secondaryColor": "string" },
  "onlineStoreInfo": {
    "website": "string",
    "socialMedia": { "instagram": "string", "facebook": "string", "twitter": "string", "tiktok": "string", "whatsapp": "string" }
  },
  "isActive": "boolean",
  "isVerified": "boolean",
  "owner": { "id": "uuid", "email": "string" },
  "products": [ "<product objects — same shape as GET /api/products/:id>" ]
}
```

**Errors:**
- `404` — Store not found or `is_active` is false

---

### `GET /api/stores/public/:websitePath`
Fetch store metadata only (no products). Used to initialise the store shell/header before products load.

**Auth required:** No

**URL params:** `websitePath` — same as `store_slug`

**Success `200`:**
```json
{
  "success": true,
  "store": { "<same shape as above, without products>" }
}
```

---

### `POST /api/stores/public/:websitePath/metrics`
Increment store-level metrics. Called client-side non-blocking after a page view or order.

**Auth required:** No

**Request body:**
```json
{
  "views": "number (default 1, optional)",
  "isOrder": "boolean (default false) — increments total_orders"
}
```

**Success `200`:**
```json
{ "success": true, "message": "Metrics updated successfully" }
```

---

### `GET /api/stores/:storeId/products`
Fetch all active products for a store, enriched with batch pricing.

**Auth required:** No

**URL params:** `storeId` — store UUID

**Query params:**
- `category` — filter by category string
- `webVisibility` — boolean filter

**Success `200`:**
```json
{
  "success": true,
  "data": [ "<array of product objects>" ]
}
```

---

## 4. Cart — `/api/cart`

All cart endpoints require authentication. The cart is created automatically on first access.

### `GET /api/cart`
Fetch the customer's cart, enriched with current product/pricing data.

**Auth required:** Yes

**Success `200`:**
```json
{
  "success": true,
  "cart": {
    "id": "uuid",
    "customerId": "uuid",
    "subtotal": "number",
    "tax": "number",
    "discount": "number",
    "shipping": "number",
    "couponDiscount": "number",
    "total": "number",
    "itemCount": "number",
    "status": "active | checked_out | expired",
    "items": [
      {
        "id": "uuid",
        "cartId": "uuid",
        "productId": "uuid",
        "storeId": "uuid",
        "quantity": "number",
        "price": "number (batch price at time of adding)",
        "subtotal": "number",
        "productSnapshot": {
          "product_name": "string",
          "sku": "string",
          "primary_image": "string",
          "category": "string",
          "available_stock": "number",
          "variant": { "variant_id": "uuid", "color": "string", "size": "string" }
        },
        "batchId": "uuid | null",
        "batchCode": "string | null",
        "addedAt": "ISO 8601"
      }
    ],
    "expiresAt": "ISO 8601"
  }
}
```

---

### `POST /api/cart`
Add a product (with optional variant) to the cart. If the item already exists, increments the quantity.

**Auth required:** Yes

**Request body:**
```json
{
  "productId": "uuid (required)",
  "quantity": "number (default 1)",
  "variantId": "uuid (optional — required if product has variants)",
  "color": "string (optional — required alongside variantId)",
  "size": "string (optional — required alongside variantId)",
  "notes": "string (optional)"
}
```

**Success `200`:**
```json
{
  "success": true,
  "cart": { "<full cart object>" },
  "message": "Item added to cart successfully",
  "pricingInfo": {
    "usingBatchPricing": "boolean",
    "batchCode": "string | null",
    "price": "number"
  }
}
```

**Errors:**
- `400` — Out of stock, variant selection required but not provided
- `404` — Product not found

**Side effects:**
- Prices are locked to the **current FIFO batch price** at time of adding to cart
- `batchId` and `batchCode` are stored on the cart item for order creation

---

### `DELETE /api/cart`
Clear the entire cart.

**Auth required:** Yes

**Success `200`:**
```json
{ "success": true, "message": "Cart cleared successfully" }
```

---

### `PATCH /api/cart/items/:productId`
Update the quantity of an item. If `quantity` is `0`, the item is removed.

**Auth required:** Yes

**URL params:** `productId` — inventory UUID

**Request body:**
```json
{
  "quantity": "number (required, 0 to remove)"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "Cart updated successfully",
  "cart": { "<full cart object>" }
}
```

---

### `DELETE /api/cart/items/:productId`
Remove a specific item from the cart.

**Auth required:** Yes

**URL params:** `productId` — inventory UUID

**Success `200`:**
```json
{
  "success": true,
  "message": "Item removed from cart",
  "cart": { "<full cart object>" }
}
```

---

### `POST /api/cart/validate`
Check whether every item in the cart still has enough available stock before proceeding to checkout.

**Auth required:** Yes

**Request body:** None

**Success `200`:**
```json
{
  "success": true,
  "isValid": "boolean",
  "unavailableItems": [
    {
      "productId": "uuid",
      "productName": "string",
      "requestedQuantity": "number",
      "availableQuantity": "number"
    }
  ]
}
```

---

## 5. Orders — `/api/orders`

### `GET /api/orders`
Fetch the authenticated customer's order history with pagination and optional status filtering.

**Auth required:** Yes

**Query params:**
- `page` — integer (default `1`)
- `limit` — integer (default `10`)
- `status` — can be repeated: `?status=pending&status=confirmed`
  - Valid values: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`

**Success `200`:**
```json
{
  "success": true,
  "orders": [
    {
      "id": "uuid",
      "orderNumber": "string (e.g. ORD-LB4KF2A-XY7Z2)",
      "status": "pending | confirmed | processing | shipped | delivered | cancelled",
      "fulfillmentStatus": "pending | fulfilled | partial",
      "subtotal": "number",
      "tax": "number",
      "shippingFee": "number",
      "discount": "number",
      "couponDiscount": "number",
      "totalAmount": "number",
      "customerNotes": "string | null",
      "orderSource": "web | pos | api",
      "createdAt": "ISO 8601",
      "updatedAt": "ISO 8601",
      "items": [ "<order item objects>" ]
    }
  ],
  "stats": {
    "total": "number",
    "pending": "number",
    "confirmed": "number",
    "processing": "number",
    "shipped": "number",
    "delivered": "number",
    "cancelled": "number"
  },
  "pagination": {
    "currentPage": "number",
    "totalPages": "number",
    "totalItems": "number",
    "hasNextPage": "boolean",
    "hasPrevPage": "boolean"
  }
}
```

---

### `GET /api/orders/:id`
Fetch a single order with full detail — items, shipping address, store snapshots, payment info, customer snapshot.

**Auth required:** Yes (order must belong to the authenticated customer)

**URL params:** `id` — order UUID

**Success `200`:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "orderNumber": "string",
    "status": "string",
    "totalAmount": "number",
    "items": [
      {
        "id": "uuid",
        "productId": "uuid",
        "storeId": "uuid",
        "quantity": "number",
        "unitPrice": "number",
        "subtotal": "number",
        "itemStatus": "pending | fulfilled | cancelled",
        "productSnapshot": {
          "productName": "string",
          "sku": "string",
          "image": "string",
          "category": "string"
        },
        "variant": { "color": "string", "size": "string", "sku": "string", "image": "string" },
        "batchId": "uuid | null",
        "batchCode": "string | null"
      }
    ],
    "stores": [
      {
        "storeId": "uuid",
        "storeName": "string",
        "storePhone": "string",
        "storeEmail": "string",
        "storeSnapshot": {
          "store_name": "string",
          "store_phone": "string",
          "address": { "street": "string", "city": "string", "state": "string", "country": "string" },
          "onlineStoreInfo": {
            "socialMedia": { "whatsapp": "string", "instagram": "string" }
          },
          "branding": { "logo": "string", "primaryColor": "string" }
        },
        "items": [ "<items belonging to this store>" ],
        "subtotal": "number"
      }
    ],
    "shippingAddress": {
      "firstName": "string",
      "lastName": "string",
      "phone": "string",
      "street": "string",
      "city": "string",
      "state": "string",
      "country": "string",
      "postalCode": "string",
      "landmark": "string | null"
    },
    "customerSnapshot": {
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "phone": "string"
    },
    "payment": {
      "method": "cash_to_vendor | bank_transfer | card",
      "provider": "string",
      "status": "pending | paid | failed",
      "amount": "number"
    },
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601"
  }
}
```

**Errors:**
- `404` — Order not found or does not belong to this customer

---

### `POST /api/orders/create`
Create an order from the customer's cart. Validates stock, reserves inventory using FIFO batch logic, saves order + all snapshots, clears cart, and sends order notification email.

**Auth required:** Yes

**Request body:**
```json
{
  "cartId": "uuid (optional — resolved from session if omitted)",
  "shippingAddress": {
    "firstName": "string (required)",
    "lastName": "string (required)",
    "phone": "string (required)",
    "email": "string (optional)",
    "street": "string (optional)",
    "city": "string (required)",
    "state": "string (required)",
    "country": "string (default: Nigeria)",
    "postalCode": "string (optional)",
    "landmark": "string (optional)"
  },
  "customerNotes": "string (optional)",
  "paymentMethod": "cash_to_vendor | bank_transfer | card (default: cash_to_vendor)"
}
```

**Success `201`:**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "order": {
    "id": "uuid",
    "orderNumber": "string",
    "status": "pending",
    "totalAmount": "number",
    "createdAt": "ISO 8601"
  }
}
```

**Errors:**
- `400` — Cart is empty or incomplete shipping address
- `400` — Insufficient stock for one or more items (includes product name + available quantity)
- `404` — A product in the cart no longer exists or is inactive

**Order creation sequence (must be atomic — roll back `orders` row on any failure):**
1. Verify session and load cart with items
2. For each cart item: validate product exists, is active, and has enough `availableQuantity` (stock minus reserved)
3. Fetch full store data for each store in the cart and cache it
4. Insert `orders` row
5. Insert `order_customers` snapshot
6. Insert `order_addresses` (type `shipping`)
7. Insert `order_payments`
8. Insert all `order_items` rows with product + variant snapshots
9. Insert `order_stores` snapshot per item
10. For each item: call `reserveStockFIFO(inventoryId, quantity, variantData?)` which updates `inventory_batches.quantity_reserved` and `inventory.quantity_reserved`
11. Insert `order_timeline` entry: `{ status: 'pending', note: 'Order created', updated_by: 'customer' }`
12. Clear cart
13. Send new order notification email to store owner(s)

---

### `PATCH /api/orders/:id/status`
Customers can only **cancel** their own orders. Status transitions to `confirmed`, `shipped`, `delivered` etc. are admin-only.

**Auth required:** Yes

**URL params:** `id` — order UUID

**Request body:**
```json
{
  "status": "cancelled"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "order": { "id": "uuid", "status": "cancelled", "cancelledAt": "ISO 8601" }
}
```

**Errors:**
- `400` — Status value is anything other than `cancelled`
- `404` — Order not found or does not belong to this customer

**Side effects:**
- When cancelling: calls `releaseOrderReservations(orderId)` — decrements `quantity_reserved` on all affected `inventory` and `inventory_batches` rows
- When status becomes `delivered` (admin endpoint, documented below): calls `fulfillOrderReservations(orderId)` — decrements `quantity_reserved`, decrements `quantity_in_stock`, increments `sold_quantity`
- Inserts `order_timeline` entry with `from_status` and `to_status`
- Sets timestamp column: `cancelled_at`, `confirmed_at`, `shipped_at`, or `delivered_at`

---

## 6. Wishlist — `/api/wishlist`

### `GET /api/wishlist`
Fetch the customer's wishlist, enriched with current product data.

**Auth required:** Yes

**Success `200`:**
```json
{
  "success": true,
  "wishlist": {
    "id": "uuid",
    "customerId": "uuid",
    "name": "string (default: My Wishlist)",
    "description": "string | null",
    "isPublic": "boolean",
    "totalItems": "number",
    "totalValue": "number",
    "items": [
      {
        "id": "uuid",
        "wishlistId": "uuid",
        "productId": "uuid",
        "priority": "low | medium | high",
        "notes": "string | null",
        "priceDropAlert": "boolean",
        "backInStockAlert": "boolean",
        "targetPrice": "number | null",
        "addedAt": "ISO 8601",
        "product": { "<current product data>" }
      }
    ]
  }
}
```

---

### `POST /api/wishlist`
Add a product to the wishlist.

**Auth required:** Yes

**Request body:**
```json
{
  "productId": "uuid (required)",
  "priority": "low | medium | high (default: medium)",
  "notes": "string (optional)",
  "notifications": {
    "priceDropAlert": "boolean (optional)",
    "backInStockAlert": "boolean (optional)",
    "targetPrice": "number (optional)"
  }
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "Item added to wishlist",
  "wishlist": { "<full wishlist object>" }
}
```

**Errors:**
- `400` — Product already in wishlist

---

### `PUT /api/wishlist`
Update wishlist-level settings (name, description, visibility).

**Auth required:** Yes

**Request body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "isPublic": "boolean (optional)"
}
```

**Success `200`:**
```json
{ "success": true, "message": "Wishlist updated successfully", "wishlist": { "<wishlist row>" } }
```

---

### `DELETE /api/wishlist/:productId`
Remove a product from the wishlist.

**Auth required:** Yes

**URL params:** `productId` — inventory UUID

**Success `200`:**
```json
{
  "success": true,
  "message": "Item removed from wishlist",
  "wishlist": { "<updated wishlist object>" }
}
```

---

### `PUT /api/wishlist/:productId`
Update settings for a specific wishlist item.

**Auth required:** Yes

**URL params:** `productId` — inventory UUID

**Request body:**
```json
{
  "priority": "low | medium | high (optional)",
  "notes": "string (optional)",
  "priceDropAlert": "boolean (optional)",
  "backInStockAlert": "boolean (optional)",
  "targetPrice": "number (optional)"
}
```

**Success `200`:**
```json
{
  "success": true,
  "message": "Wishlist item updated",
  "wishlist": { "<updated wishlist object>" }
}
```

---

## 7. Admin Endpoints (IVMA App — Store Owner / Admin)

These endpoints are consumed by the IVMA inventory management app. They require a **different auth mechanism** — the store owner is authenticated via Supabase Auth (not the customer session system).

> The IVMA app currently makes direct Supabase calls. The new backend should expose these as proper API endpoints so the IVMA app does not need the Supabase service key.

### Order Management (Admin)

#### `GET /admin/orders`
Fetch all orders for a store (or all stores if super-admin).

**Query params:**
- `storeId` — filter by store UUID
- `status` — filter by status
- `page`, `limit`
- `dateFrom`, `dateTo` — ISO 8601 date range

---

#### `PATCH /admin/orders/:id/status`
Update order status. Admins can set any valid status including `confirmed`, `processing`, `shipped`, `delivered`.

**Request body:**
```json
{
  "status": "confirmed | processing | shipped | delivered | cancelled",
  "note": "string (optional, shown in order timeline)"
}
```

**Side effects:**
- `delivered` → triggers `fulfillOrderReservations` (stock deduction)
- `cancelled` → triggers `releaseOrderReservations` (stock release)
- Inserts `order_timeline` entry

---

### Inventory Management (Admin)

#### `GET /admin/inventory`
Fetch all inventory for a store.

#### `POST /admin/inventory`
Create a new inventory item.

**Request body:**
```json
{
  "storeId": "uuid",
  "name": "string",
  "sku": "string",
  "category": "string",
  "description": "string",
  "basePrice": "number",
  "cost": "number",
  "minimumStock": "number",
  "hasVariants": "boolean",
  "webVisibility": "boolean",
  "images": ["string (URL)"]
}
```

#### `PATCH /admin/inventory/:id`
Update inventory item details.

#### `DELETE /admin/inventory/:id`
Soft-delete (set `is_active: false`).

---

#### `POST /admin/inventory/:id/batches`
Add a new stock batch (FIFO tracking).

**Request body:**
```json
{
  "batchCode": "string",
  "quantityIn": "number",
  "costPrice": "number",
  "sellingPrice": "number",
  "dateReceived": "ISO 8601",
  "expiryDate": "ISO 8601 | null",
  "supplier": "string (optional)"
}
```

---

#### `GET /admin/inventory/:id/batches`
Fetch all batches for an inventory item.

---

#### `POST /admin/inventory/:id/variants`
Add a variant (color/size combination) to a product.

**Request body:**
```json
{
  "color": "string",
  "size": "string",
  "sku": "string",
  "quantityInStock": "number",
  "price": "number",
  "costPrice": "number",
  "images": ["string"]
}
```

---

### Customer Management (Admin)

#### `GET /admin/customers`
Fetch all customers with pagination and search.

#### `GET /admin/customers/:id`
Fetch a customer with their order history.

---

### Store Management (Admin)

#### `GET /admin/stores`
Fetch all stores (super-admin only).

#### `GET /admin/stores/:id`
Fetch a store.

#### `PATCH /admin/stores/:id`
Update store settings, branding, social media links.

---

## 8. Email Notifications

The backend must send the following transactional emails:

| Trigger | Recipient | Template |
|---|---|---|
| Registration | Customer | Verification code |
| Verification (resend) | Customer | New verification code |
| Email verified | Customer | Welcome email |
| Forgot password | Customer | Password reset link (15 min expiry) |
| Order created | Store owner(s) | New order notification with order details |

The current implementation uses a custom `email.js` lib (wraps Resend or Nodemailer). The backend should implement the same sending functions.
