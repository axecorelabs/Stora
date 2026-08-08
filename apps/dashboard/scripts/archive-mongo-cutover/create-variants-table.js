#!/usr/bin/env node

import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config({ path: '.env.local' });

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
  },
  logging: false
});

async function createInventoryVariantsTable() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database\n');

    // Create the inventory_variants table
    console.log('📋 Creating inventory_variants table...');
    
    await sequelize.query(`
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
      )
    `);
    console.log('✅ Table created');

    // Create indexes
    console.log('📋 Creating indexes...');
    
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_inventory_variants_inventory_id ON inventory_variants(inventory_id)`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_inventory_variants_sku ON inventory_variants(sku)`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_inventory_variants_color ON inventory_variants(color)`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_inventory_variants_size ON inventory_variants(size)`);
    await sequelize.query(`CREATE INDEX IF NOT EXISTS idx_inventory_variants_is_active ON inventory_variants(is_active)`);
    
    console.log('✅ Indexes created');
    
    // Verify table exists
    const [results] = await sequelize.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_variants' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Table structure:');
    results.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));
    
    console.log('\n✅ inventory_variants table is ready!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

createInventoryVariantsTable();
