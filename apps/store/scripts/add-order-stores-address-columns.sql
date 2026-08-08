-- Add all missing columns to order_stores table for complete store snapshot
ALTER TABLE order_stores 
-- Address columns
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Nigeria',
ADD COLUMN IF NOT EXISTS postal_code TEXT,
-- Online presence columns  
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS twitter TEXT,
ADD COLUMN IF NOT EXISTS tiktok TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
-- Branding columns
ADD COLUMN IF NOT EXISTS logo TEXT,
ADD COLUMN IF NOT EXISTS primary_color TEXT,
ADD COLUMN IF NOT EXISTS secondary_color TEXT;

-- Add comments explaining the purpose
COMMENT ON COLUMN order_stores.street IS 'Store business address street at time of order';
COMMENT ON COLUMN order_stores.city IS 'Store business address city at time of order';
COMMENT ON COLUMN order_stores.state IS 'Store business address state at time of order';
COMMENT ON COLUMN order_stores.country IS 'Store business address country at time of order';
COMMENT ON COLUMN order_stores.postal_code IS 'Store business address postal code at time of order';
COMMENT ON COLUMN order_stores.website IS 'Store website URL at time of order';
COMMENT ON COLUMN order_stores.instagram IS 'Store Instagram handle at time of order';
COMMENT ON COLUMN order_stores.facebook IS 'Store Facebook page at time of order';
COMMENT ON COLUMN order_stores.twitter IS 'Store Twitter handle at time of order';
COMMENT ON COLUMN order_stores.tiktok IS 'Store TikTok handle at time of order';
COMMENT ON COLUMN order_stores.whatsapp IS 'Store WhatsApp number at time of order';
COMMENT ON COLUMN order_stores.logo IS 'Store logo URL at time of order';
COMMENT ON COLUMN order_stores.primary_color IS 'Store primary brand color at time of order';
COMMENT ON COLUMN order_stores.secondary_color IS 'Store secondary brand color at time of order';
