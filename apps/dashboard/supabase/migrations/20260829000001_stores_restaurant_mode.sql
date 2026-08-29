-- Restaurant Mode: a per-store, non-restrictive toggle. Enabling it does
-- not restrict what a store can sell -- it only changes which UI a vendor
-- and their shoppers see (a dedicated menu-item form, a sectioned menu
-- storefront layout instead of the generic grid).
ALTER TABLE stores ADD COLUMN IF NOT EXISTS restaurant_mode BOOLEAN NOT NULL DEFAULT false;
