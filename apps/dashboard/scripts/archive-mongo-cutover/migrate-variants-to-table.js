#!/usr/bin/env node

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const isDryRun = process.argv.includes('--dry-run');

/**
 * Create the inventory_variants table if it doesn't exist
 */
async function createVariantsTable() {
  console.log('📋 Creating inventory_variants table...');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS inventory_variants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
      mongo_id VARCHAR(100),
      size VARCHAR(50) NOT NULL,
      color VARCHAR(50) NOT NULL,
      sku VARCHAR(100),
      quantity_in_stock INTEGER DEFAULT 0 CHECK (quantity_in_stock >= 0),
      reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
      reorder_level INTEGER DEFAULT 5 CHECK (reorder_level >= 0),
      sold_quantity INTEGER DEFAULT 0 CHECK (sold_quantity >= 0),
      price DECIMAL(12, 2),
      cost_price DECIMAL(12, 2),
      images TEXT[],
      barcode VARCHAR(100),
      weight DECIMAL(8, 3),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(inventory_id, size, color)
    );
    
    -- Create indexes for better performance
    CREATE INDEX IF NOT EXISTS idx_inventory_variants_inventory_id ON inventory_variants(inventory_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_variants_sku ON inventory_variants(sku);
    CREATE INDEX IF NOT EXISTS idx_inventory_variants_color ON inventory_variants(color);
    CREATE INDEX IF NOT EXISTS idx_inventory_variants_size ON inventory_variants(size);
    CREATE INDEX IF NOT EXISTS idx_inventory_variants_is_active ON inventory_variants(is_active);
  `;

  const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL }).maybeSingle();
  
  // If RPC doesn't exist, try direct query approach
  if (error) {
    console.log('ℹ️ Using alternative table creation method...');
    
    // Check if table exists first
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'inventory_variants')
      .eq('table_schema', 'public');
    
    if (!tables || tables.length === 0) {
      console.log('⚠️ Table does not exist. Please run this SQL in Supabase dashboard:');
      console.log(createTableSQL);
      console.log('\nOr run the script with --create-table flag after creating the table manually.');
      return false;
    }
  }
  
  console.log('✅ inventory_variants table ready');
  return true;
}

/**
 * Parse variants from nested JSON (handles double-stringified data)
 */
function parseVariants(variantsData) {
  if (!variantsData) return [];
  
  let parsed = variantsData;
  
  // Parse until we get an array
  while (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      console.error('Error parsing variants:', e.message);
      return [];
    }
  }
  
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Migrate nested variants to the inventory_variants table
 */
async function migrateVariants() {
  console.log('🔄 Starting variant migration...\n');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No data will be written\n');
  }
  
  // First, try to create the table
  const tableReady = await createVariantsTable();
  
  // Get all inventory items that have variants
  const { data: inventoryItems, error: fetchError } = await supabase
    .from('inventory')
    .select('id, name, variants, has_variants, base_price, cost')
    .not('variants', 'is', null);
  
  if (fetchError) {
    console.error('❌ Error fetching inventory:', fetchError.message);
    process.exit(1);
  }
  
  console.log(`📊 Found ${inventoryItems?.length || 0} inventory items with variants data\n`);
  
  let migratedCount = 0;
  let variantCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  const errors = [];
  
  for (const item of inventoryItems || []) {
    const variants = parseVariants(item.variants);
    
    if (variants.length === 0) {
      skippedCount++;
      continue;
    }
    
    console.log(`\n📦 Processing: ${item.name} (${variants.length} variants)`);
    
    for (const variant of variants) {
      try {
        // Transform variant data - use variant price if exists, otherwise parent price
        const variantData = {
          id: uuidv4(),
          inventory_id: item.id,
          mongo_id: variant._id?.toString() || null,
          size: variant.size || 'One Size',
          color: variant.color || 'Default',
          sku: variant.sku || null,
          quantity_in_stock: variant.quantityInStock || 0,
          reorder_level: variant.reorderLevel || 5,
          sold_quantity: variant.soldQuantity || 0,
          price: variant.price || variant.sellingPrice || item.base_price || 0,
          cost_price: variant.costPrice || variant.cost || item.cost || 0,
          images: Array.isArray(variant.images) ? variant.images : [],
          barcode: variant.barcode || null,
          is_active: variant.isActive !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        if (isDryRun) {
          console.log(`  ✓ Would create variant: ${variantData.color} / ${variantData.size} (Stock: ${variantData.quantity_in_stock}, Price: ${variantData.price})`);
        } else {
          // Check if variant already exists
          const { data: existing } = await supabase
            .from('inventory_variants')
            .select('id')
            .eq('inventory_id', item.id)
            .eq('size', variantData.size)
            .eq('color', variantData.color)
            .maybeSingle();
          
          if (existing) {
            // Update existing variant
            const { error: updateError } = await supabase
              .from('inventory_variants')
              .update({
                quantity_in_stock: variantData.quantity_in_stock,
                sold_quantity: variantData.sold_quantity,
                reorder_level: variantData.reorder_level,
                sku: variantData.sku,
                price: variantData.price,
                cost_price: variantData.cost_price,
                images: variantData.images,
                is_active: variantData.is_active,
                updated_at: variantData.updated_at
              })
              .eq('id', existing.id);
            
            if (updateError) throw updateError;
            console.log(`  🔄 Updated variant: ${variantData.color} / ${variantData.size} (Price: ${variantData.price})`);
          } else {
            // Insert new variant
            const { error: insertError } = await supabase
              .from('inventory_variants')
              .insert(variantData);
            
            if (insertError) throw insertError;
            console.log(`  ✅ Created variant: ${variantData.color} / ${variantData.size}`);
          }
        }
        
        variantCount++;
        
      } catch (error) {
        errorCount++;
        errors.push({
          item: item.name,
          variant: `${variant.color} / ${variant.size}`,
          error: error.message
        });
        console.error(`  ❌ Error: ${error.message}`);
      }
    }
    
    // Update the has_variants flag on the parent item
    if (!isDryRun && variants.length > 0) {
      await supabase
        .from('inventory')
        .update({ has_variants: true })
        .eq('id', item.id);
    }
    
    migratedCount++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 Migration Summary:');
  console.log('='.repeat(50));
  console.log(`✅ Items processed: ${migratedCount}`);
  console.log(`✅ Variants migrated: ${variantCount}`);
  console.log(`⏭️ Items skipped (no variants): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  if (errors.length > 0 && errors.length <= 10) {
    console.log('\n❌ Error details:');
    errors.forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.item} - ${e.variant}: ${e.error}`);
    });
  }
  
  if (isDryRun) {
    console.log('\n💡 Run without --dry-run to apply changes');
  }
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  console.log('\n🔍 Verifying migration...\n');
  
  // Count variants in table
  const { count: variantTableCount } = await supabase
    .from('inventory_variants')
    .select('*', { count: 'exact', head: true });
  
  // Count items with has_variants = true
  const { data: itemsWithVariants } = await supabase
    .from('inventory')
    .select('id, name')
    .eq('has_variants', true);
  
  console.log(`📊 Variants in table: ${variantTableCount || 0}`);
  console.log(`📊 Items with variants: ${itemsWithVariants?.length || 0}`);
  
  // Show sample data
  if (itemsWithVariants && itemsWithVariants.length > 0) {
    console.log('\n📋 Sample items with variants:');
    for (const item of itemsWithVariants.slice(0, 3)) {
      const { data: variants } = await supabase
        .from('inventory_variants')
        .select('size, color, quantity_in_stock')
        .eq('inventory_id', item.id)
        .limit(5);
      
      console.log(`\n  ${item.name}:`);
      variants?.forEach(v => {
        console.log(`    - ${v.color} / ${v.size}: ${v.quantity_in_stock} in stock`);
      });
    }
  }
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];
  
  if (!command) {
    console.log('Usage:');
    console.log('  node scripts/migrate-variants-to-table.js migrate [--dry-run]');
    console.log('  node scripts/migrate-variants-to-table.js verify');
    console.log('  node scripts/migrate-variants-to-table.js create-table');
    process.exit(1);
  }
  
  try {
    if (command === 'create-table') {
      await createVariantsTable();
    } else if (command === 'migrate' || command === '--dry-run') {
      await migrateVariants();
    } else if (command === 'verify') {
      await verifyMigration();
    } else {
      console.error('❌ Unknown command:', command);
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

main();
