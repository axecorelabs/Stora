-- Per-item "note to seller" (e.g. "no onions", "extra spicy") -- cart_items
-- already had this column (initial schema) and the add-to-cart API already
-- threads it through end to end, but it was silently dropped when a cart
-- converts to an order since order_items had nowhere to put it. This closes
-- that gap so the note a customer typed while adding the item survives all
-- the way to the order the vendor sees.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT;
