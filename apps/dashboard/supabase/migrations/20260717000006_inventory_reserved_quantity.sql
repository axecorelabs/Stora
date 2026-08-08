-- inventory needs its own reservation counter (aggregate across variants, or
-- direct for non-variant products) -- ivma-store's checkout reservation flow
-- (supabaseOrders.js) and its read-side transform (supabaseStore.js) both
-- already consistently depend on inventory.quantity_reserved existing.

ALTER TABLE inventory ADD COLUMN quantity_reserved INTEGER DEFAULT 0 CHECK (quantity_reserved >= 0);
