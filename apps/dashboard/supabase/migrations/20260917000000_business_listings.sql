-- Business Listings: a paid ₦500/month product where a vendor can list
-- their business for discoverability without setting up a full store.
--
-- platform_mode distinguishes the two tracks on the same vendor account:
--   'store'   -- the existing full-commerce flow (default for all existing rows)
--   'listing' -- showcase-only: gallery, contact info, no ordering
--
-- NOT store_type (which is already 'physical'/'online' -- whether the vendor
-- has a physical location) -- platform_mode is a separate concern.
--
-- subscription_status gates public visibility for listing-mode stores:
--   'active'    -- subscription paid, listing is live
--   'past_due'  -- payment failed, listing hidden
--   'cancelled' -- vendor cancelled
--   'none'      -- default for store-mode vendors (no subscription involved)
--
-- subscription_paystack_code: Paystack subscription code (SUB_xxx) for
-- managing/cancelling via the Paystack API.
--
-- subscription_next_payment_date: when the next charge is due, synced from
-- Paystack subscription webhooks so the dashboard can show it.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS platform_mode TEXT NOT NULL DEFAULT 'store',
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS subscription_paystack_code TEXT,
  ADD COLUMN IF NOT EXISTS subscription_next_payment_date TIMESTAMPTZ;

-- gallery_items: up to 10 images per listing store, ordered by sort_order.
-- image_url points to the R2 object (same bucket as product images).
-- caption is optional display text shown under each image on the showcase.
CREATE TABLE IF NOT EXISTS gallery_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  image_url      TEXT NOT NULL,
  caption        TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gallery_items_store_id_sort ON gallery_items (store_id, sort_order);

-- RLS: store owner reads/writes their own gallery; public read for active listings.
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- Service role (used by dashboard API routes via supabaseAdmin) bypasses RLS --
-- no policy needed for that path. Public read is for the store app's showcase render.
CREATE POLICY "Public read gallery items" ON gallery_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM stores
      WHERE stores.id = gallery_items.store_id
        AND stores.platform_mode = 'listing'
        AND stores.subscription_status = 'active'
    )
  );

NOTIFY pgrst, 'reload schema';
