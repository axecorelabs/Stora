# Stock Reservation System

## Overview
The system now uses a proper stock reservation model instead of immediately deducting from inventory when orders are placed. This prevents overselling and properly tracks the lifecycle of inventory.

## Database Fields

### Inventory Table
- `quantity_in_stock` - Total physical stock available
- `quantity_reserved` - Stock reserved for pending/confirmed orders
- `sold_quantity` - Total quantity sold and fulfilled
- **Available Quantity** = `quantity_in_stock - quantity_reserved`

### Inventory Batches Table
- `quantity_in` - Total quantity received in this batch
- `quantity_sold` - Quantity already sold from this batch
- `quantity_reserved` - Quantity reserved from this batch
- `quantity_remaining` - Current remaining quantity
- **Available Quantity** = `quantity_remaining - quantity_reserved`

### Inventory Variants Table
- `quantity_in_stock` - Total variant stock
- `reserved_quantity` - Variant stock reserved
- `sold_quantity` - Variant quantity sold
- **Available Quantity** = `quantity_in_stock - reserved_quantity`

## Order Lifecycle & Stock Flow

### 1. **Adding to Cart**
- **Check**: `availableQuantity` (stock - reserved) >= requested quantity
- **Action**: No database changes yet
- **Location**: `supabaseCart.js` - `prepareCartItemData()`

### 2. **Placing Order (Status: Pending)**
- **Check**: Validate available stock again
- **Action**: Reserve stock using FIFO
  - Increases `quantity_reserved` in inventory
  - Increases `quantity_reserved` in batches (FIFO order)
  - Does NOT decrease `quantity_in_stock` yet
- **Location**: 
  - `orders/create/route.js` - calls `reserveStockFIFO()`
  - `supabaseOrders.js` - `reserveStockFIFO()`

### 3. **Order Confirmed (Status: Confirmed)**
- **Check**: None (already reserved)
- **Action**: Stock remains reserved
- **Note**: Inventory is still held but not yet deducted

### 4. **Order Delivered (Status: Delivered)**
- **Check**: None
- **Action**: Fulfill reservation
  - Decreases `quantity_reserved`
  - Decreases `quantity_in_stock`
  - Increases `sold_quantity`
  - Updates batch `quantity_sold` and `quantity_remaining`
- **Location**: `supabaseOrders.js` - `fulfillOrderReservations()`

### 5. **Order Cancelled (Status: Cancelled)**
- **Check**: None
- **Action**: Release reservation
  - Decreases `quantity_reserved`
  - Does NOT change `quantity_in_stock` (returns to available pool)
  - Releases from batches
- **Location**: `supabaseOrders.js` - `releaseOrderReservations()`

## FIFO (First-In-First-Out) System

Stock reservations and fulfillments follow FIFO based on `date_received`:
1. Sort batches by oldest first (`date_received ASC`)
2. Reserve/fulfill from oldest batches first
3. Move to next batch when current is depleted
4. Update batch status to 'depleted' when `quantity_remaining` reaches 0

## API Functions

### Stock Reservation
```javascript
// Reserve stock for an order (increases quantity_reserved)
await reserveStockFIFO(inventoryId, quantity, variantData);
```

### Stock Release (Cancel Order)
```javascript
// Release reserved stock back to available pool
await releaseOrderReservations(orderId);
```

### Stock Fulfillment (Deliver Order)
```javascript
// Fulfill reservation (deduct from stock, mark as sold)
await fulfillOrderReservations(orderId);
```

### Order Status Update (Automated)
```javascript
// Automatically handles stock based on status
await updateOrderStatus(orderId, 'cancelled'); // Releases reservation
await updateOrderStatus(orderId, 'delivered'); // Fulfills reservation
```

## Stock Calculation Examples

### Example: Product with 100 units

**Initial State:**
- `quantity_in_stock` = 100
- `quantity_reserved` = 0
- `sold_quantity` = 0
- **Available** = 100

**After Order 1 (20 units) - Pending:**
- `quantity_in_stock` = 100 (unchanged)
- `quantity_reserved` = 20
- `sold_quantity` = 0
- **Available** = 80

**After Order 2 (30 units) - Pending:**
- `quantity_in_stock` = 100 (unchanged)
- `quantity_reserved` = 50
- `sold_quantity` = 0
- **Available** = 50

**Order 1 Delivered:**
- `quantity_in_stock` = 80 (decreased)
- `quantity_reserved` = 30 (decreased by 20)
- `sold_quantity` = 20 (increased)
- **Available** = 50

**Order 2 Cancelled:**
- `quantity_in_stock` = 80 (unchanged)
- `quantity_reserved` = 0 (decreased by 30)
- `sold_quantity` = 20 (unchanged)
- **Available** = 80 (returned to pool)

## Benefits

1. **Prevents Overselling**: Reserved stock cannot be sold to multiple customers
2. **Accurate Availability**: Customers see real-time available stock
3. **Order Management**: Easy to cancel orders without complex rollbacks
4. **Inventory Tracking**: Clear audit trail of stock movements
5. **Multi-Status Support**: Stock lifecycle matches order lifecycle
6. **Variant Support**: Proper handling of product variants
7. **Batch Tracking**: Maintains FIFO and batch-level reservations

## Important Notes

- Always check `availableQuantity` (not just `quantity_in_stock`) before adding to cart
- Reservations are made at order placement, not at cart addition
- Stock is only physically deducted when order is delivered
- Cancelled orders automatically free up reserved stock
- System handles both simple products and variants
- FIFO ensures oldest stock is used first
