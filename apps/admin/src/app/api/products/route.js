import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const PAGE_SIZE = 50;

// Same resilient primary-image resolution apps/dashboard's own
// /api/inventory route uses -- primary_image is the preferred column, but
// falls back to the images array, whose entries can be a raw URL string,
// a JSON-stringified object, or an object already ({url, isPrimary}).
function resolveImageUrl(item) {
  if (item.primary_image) return item.primary_image;
  let images = [];
  try {
    images = (item.images || []).map((img) => {
      if (typeof img === 'string') {
        try {
          return JSON.parse(img);
        } catch {
          return { url: img };
        }
      }
      return img;
    });
  } catch {
    images = [];
  }
  const primaryImg = images.find((img) => img && img.isPrimary);
  return primaryImg?.url || images[0]?.url || null;
}

// Lists inventory items across every store for the Products admin screen.
// Excludes soft-deleted rows (is_deleted) -- those are gone as far as the
// vendor is concerned; is_active is the one this screen's toggle controls
// (a reversible "hide this listing" action, not the vendor's own delete).
export async function GET(request) {
  const staff = await verifySession(request);
  if (!staff) {
    return NextResponse.json({ success: false, message: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  const storeId = searchParams.get('storeId');
  const category = searchParams.get('category');
  const offset = parseInt(searchParams.get('offset')) || 0;

  let query = supabaseAdmin
    .from('inventory')
    .select('id, name, sku, category, is_active, store_id, created_at, primary_image, images', { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (q) {
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  }
  if (storeId) {
    query = query.eq('store_id', storeId);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data: items, error, count } = await query;
  if (error) {
    console.error('Error listing products:', error);
    return NextResponse.json({ success: false, message: 'Failed to load products' }, { status: 500 });
  }

  // inventory.stock_quantity/base_price were both dropped -- stock and
  // price now live on inventory_variants exclusively. Stock is a sum
  // across variants; price uses the first variant's price as the
  // representative price, same convention apps/dashboard's own
  // /api/inventory route uses (today's product UI only ever sets one
  // price for the whole product, applied to every variant).
  const itemIds = (items || []).map((i) => i.id);
  let stockByInventoryId = new Map();
  let priceByInventoryId = new Map();
  if (itemIds.length > 0) {
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from('inventory_variants')
      .select('inventory_id, quantity_in_stock, price')
      .in('inventory_id', itemIds);
    if (variantsError) {
      console.error('Error loading product variants:', variantsError);
      return NextResponse.json({ success: false, message: 'Failed to load products' }, { status: 500 });
    }
    (variants || []).forEach((v) => {
      stockByInventoryId.set(v.inventory_id, (stockByInventoryId.get(v.inventory_id) || 0) + (v.quantity_in_stock || 0));
      if (!priceByInventoryId.has(v.inventory_id)) priceByInventoryId.set(v.inventory_id, v.price);
    });
  }

  const storeIds = [...new Set((items || []).map((i) => i.store_id).filter(Boolean))];
  let storesById = new Map();
  if (storeIds.length > 0) {
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, store_name, store_slug, branding')
      .in('id', storeIds);
    if (storesError) {
      console.error('Error loading product stores:', storesError);
      return NextResponse.json({ success: false, message: 'Failed to load products' }, { status: 500 });
    }
    storesById = new Map((stores || []).map((s) => [s.id, s]));
  }

  return NextResponse.json({
    success: true,
    total: count || 0,
    products: (items || []).map((item) => {
      const store = storesById.get(item.store_id);
      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        imageUrl: resolveImageUrl(item),
        basePrice: parseFloat(priceByInventoryId.get(item.id)) || 0,
        stockQuantity: stockByInventoryId.get(item.id) || 0,
        isActive: !!item.is_active,
        createdAt: item.created_at,
        store: store
          ? {
              id: store.id,
              storeName: store.store_name,
              storeSlug: store.store_slug,
              logoUrl: (typeof store.branding === 'string' ? JSON.parse(store.branding) : store.branding || {}).logo || null
            }
          : null
      };
    })
  });
}
