import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/auth';
import { backfillMissingSkus } from '@/lib/inventorySku';

// Helper to transform inventory data for response
function transformInventory(item) {
  if (!item) return null;
  
  // Parse images safely - each image in the array may be a JSON string
  let images = [];
  try {
    const rawImages = item.images || [];
    images = rawImages.map(img => {
      if (typeof img === 'string') {
        try {
          return JSON.parse(img);
        } catch (e) {
          return { url: img };
        }
      }
      return img;
    });
  } catch (e) {
    images = [];
  }
  
  // Get primary image URL
  let primaryImage = null;
  if (images.length > 0) {
    const primaryImg = images.find(img => img && img.isPrimary);
    primaryImage = (primaryImg?.url) || (images[0]?.url) || null;
  }
  
  // Variants will be fetched separately from inventory_variants table
  // Keep empty array here, will be populated by GET handler
  
  return {
    id: item.id,
    _id: item.id,
    mongoId: item.mongo_id,
    userId: item.user_id,
    productName: item.name,
    name: item.name,
    description: item.description,
    brand: item.brand,
    supplier: item.supplier,
    location: item.location,
    category: item.category,
    categoryDetails: item.category_details,
    variants: [], // Populated separately from inventory_variants table
    hasVariants: item.has_variants || false,
    sellingPrice: item.base_price,
    basePrice: item.base_price,
    costPrice: item.cost,
    cost: item.cost,
    sku: item.sku,
    barcode: item.barcode,
    quantityInStock: item.stock_quantity,
    stockQuantity: item.stock_quantity,
    minimumStock: item.minimum_stock,
    reorderLevel: item.minimum_stock,
    unitOfMeasure: item.unit_of_measure || 'Piece',
    images: images,
    image: primaryImage, // Primary image URL for easy access
    primaryImage: primaryImage,
    tags: typeof item.tags === 'string' ? JSON.parse(item.tags || '[]') : item.tags || [],
    isActive: item.is_active,
    status: item.is_active ? 'Active' : 'Inactive',
    createdAt: item.created_at,
    updatedAt: item.updated_at
  };
}

// GET - Fetch specific inventory item
export async function GET(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const { data: item, error } = await supabaseAdmin
      .from('inventory')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !item) {
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    // Backfill SKU if this item was created before SKU generation existed
    await backfillMissingSkus([item]);

    // Fetch variants from the normalized table if has_variants is true
    let variants = [];
    if (item.has_variants) {
      const { data: variantData } = await supabaseAdmin
        .from('inventory_variants')
        .select('*')
        .eq('inventory_id', id)
        .eq('is_active', true)
        .order('color', { ascending: true })
        .order('size', { ascending: true });
      
      variants = (variantData || []).map(v => ({
        _id: v.id,
        id: v.id,
        size: v.size,
        color: v.color,
        sku: v.sku,
        quantityInStock: v.quantity_in_stock,
        reorderLevel: v.reorder_level,
        soldQuantity: v.sold_quantity,
        images: v.images || [],
        barcode: v.barcode,
        isActive: v.is_active,
        price: v.price,
        costPrice: v.cost_price
      }));
    }

    const transformedItem = transformInventory(item);
    // Override variants with normalized data
    transformedItem.variants = variants;

    return NextResponse.json({
      success: true,
      data: transformedItem
    });

  } catch (error) {
    console.error('Inventory item fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update specific inventory item
export async function PUT(request, { params }) {
  try {
    const user = await verifySession(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const updateData = await request.json();

    // Build update object with snake_case keys
    const dbUpdate = {
      updated_at: new Date().toISOString()
    };

    if (updateData.productName || updateData.name) {
      dbUpdate.name = updateData.productName || updateData.name;
    }
    if (updateData.description !== undefined) {
      dbUpdate.description = updateData.description;
    }
    if (updateData.category) {
      dbUpdate.category = updateData.category;
    }
    if (updateData.categoryDetails) {
      dbUpdate.category_details = updateData.categoryDetails;
    }
    if (updateData.variants) {
      dbUpdate.has_variants = updateData.hasVariants !== undefined
        ? updateData.hasVariants
        : (updateData.variants && updateData.variants.length > 0);
    }
    if (updateData.hasVariants !== undefined) {
      dbUpdate.has_variants = updateData.hasVariants;
    }
    if (updateData.sellingPrice !== undefined || updateData.basePrice !== undefined) {
      dbUpdate.base_price = updateData.sellingPrice || updateData.basePrice;
    }
    if (updateData.costPrice !== undefined || updateData.cost !== undefined) {
      dbUpdate.cost = updateData.costPrice || updateData.cost;
    }
    if (updateData.sku) {
      dbUpdate.sku = updateData.sku;
    }
    if (updateData.barcode !== undefined) {
      dbUpdate.barcode = updateData.barcode;
    }
    if (updateData.quantityInStock !== undefined || updateData.stockQuantity !== undefined) {
      dbUpdate.stock_quantity = updateData.quantityInStock || updateData.stockQuantity;
    }
    if (updateData.minimumStock !== undefined || updateData.reorderLevel !== undefined) {
      dbUpdate.minimum_stock = updateData.minimumStock || updateData.reorderLevel;
    }
    if (updateData.images) {
      dbUpdate.images = updateData.images;
    }
    if (updateData.tags) {
      dbUpdate.tags = updateData.tags;
    }
    if (updateData.isActive !== undefined) {
      dbUpdate.is_active = updateData.isActive;
    }

    const { data: item, error } = await supabaseAdmin
      .from('inventory')
      .update(dbUpdate)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Inventory update error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, message: 'Item not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { success: false, message: 'Failed to update inventory item' },
        { status: 500 }
      );
    }

    // Variants live in the normalized inventory_variants table, not as a column on inventory
    if (updateData.variants) {
      const { error: deleteVariantsError } = await supabaseAdmin
        .from('inventory_variants')
        .delete()
        .eq('inventory_id', id);

      if (deleteVariantsError) {
        console.error('Variant deletion error:', deleteVariantsError);
      } else if (updateData.variants.length > 0) {
        const variantRows = updateData.variants.map(v => ({
          inventory_id: id,
          size: v.size || 'One Size',
          color: v.color,
          sku: v.sku || null,
          quantity_in_stock: v.quantityInStock || 0,
          reorder_level: v.reorderLevel || 5,
          images: v.images || []
        }));

        const { error: variantsError } = await supabaseAdmin
          .from('inventory_variants')
          .insert(variantRows);

        if (variantsError) {
          console.error('Variant creation error:', variantsError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: transformInventory(item)
    });

  } catch (error) {
    console.error('Error updating inventory item:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update inventory item' },
      { status: 500 }
    );
  }
}

// DELETE - Delete specific inventory item
export async function DELETE(req, { params }) {
  try {
    const user = await verifySession(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Delete the inventory item
    const { error } = await supabaseAdmin
      .from('inventory')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Inventory delete error:', error);
      return NextResponse.json(
        { success: false, message: 'Inventory item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Inventory item deleted successfully'
    });

  } catch (error) {
    console.error('Inventory item delete error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
