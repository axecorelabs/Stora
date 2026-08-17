-- Tracks which order (if any) currently "owns" a cart item while its
-- payment is unresolved. Needed because clearCart()/removeItemsFromCart()
-- is moving from "right after order creation" to "only once payment
-- actually confirms" (apps/store/src/lib/supabasePayments.js's
-- confirmOrderPayment) -- if the cart item just stays in the cart
-- untouched while payment is pending, nothing stops the customer from
-- checking out the same item a second time before the first attempt
-- resolves, reserving stock twice for one purchase. pending_order_id lets
-- orders/create/route.js detect and block that, and lets
-- confirmOrderPayment/the abandoned-order-cancellation path know exactly
-- which cart items to release (clear on success, un-flag on cancellation)
-- without re-deriving it via product/store matching.
ALTER TABLE cart_items ADD COLUMN pending_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
CREATE INDEX idx_cart_items_pending_order_id ON cart_items(pending_order_id) WHERE pending_order_id IS NOT NULL;
