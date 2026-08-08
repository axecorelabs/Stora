#!/usr/bin/env node

import dotenv from 'dotenv';
import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
  },
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const isDryRun = process.argv.includes('--dry-run');

async function addStoreIdToInventory() {
  try {
    console.log('🚀 Starting inventory store_id migration...\n');

    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written\n');
    }

    // Test connection
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established\n');

    // Check if store_id column exists
    const [columns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory' AND column_name = 'store_id'
    `);

    if (columns.length === 0) {
      console.log('📝 Adding store_id column to inventory table...');
      
      if (!isDryRun) {
        await sequelize.query(`
          ALTER TABLE inventory 
          ADD COLUMN store_id UUID REFERENCES stores(id) ON DELETE SET NULL
        `);
        
        // Create index for better performance
        await sequelize.query(`
          CREATE INDEX IF NOT EXISTS idx_inventory_store_id ON inventory(store_id)
        `);
        
        console.log('✅ store_id column added successfully\n');
      } else {
        console.log('[DRY RUN] Would add store_id column\n');
      }
    } else {
      console.log('ℹ️  store_id column already exists\n');
    }

    // Get inventory items that need store_id updated
    const [inventoryItems] = await sequelize.query(`
      SELECT 
        i.id,
        i.user_id,
        i.name,
        i.store_id as current_store_id
      FROM inventory i
      WHERE i.user_id IS NOT NULL
      ORDER BY i.created_at
    `);

    console.log(`📊 Found ${inventoryItems.length} inventory items with user_id\n`);

    if (inventoryItems.length === 0) {
      console.log('ℹ️  No inventory items to update');
      return;
    }

    // Get user to store mapping
    const [userStoreMapping] = await sequelize.query(`
      SELECT 
        s.owner_id as user_id,
        s.id as store_id,
        s.store_name
      FROM stores s
      WHERE s.owner_id IS NOT NULL
    `);

    console.log(`📊 Found ${userStoreMapping.length} stores with user mappings\n`);

    // Create a map for quick lookup
    const userToStoreMap = new Map();
    userStoreMapping.forEach(row => {
      userToStoreMap.set(row.user_id, {
        storeId: row.store_id,
        storeName: row.store_name
      });
    });

    let updatedCount = 0;
    let skippedCount = 0;
    let alreadySetCount = 0;

    console.log('🔄 Updating inventory items with store_id...\n');

    for (const item of inventoryItems) {
      const storeInfo = userToStoreMap.get(item.user_id);

      if (!storeInfo) {
        console.log(`⚠️  No store found for user_id: ${item.user_id} (item: ${item.name})`);
        skippedCount++;
        continue;
      }

      // Check if already set
      if (item.current_store_id === storeInfo.storeId) {
        alreadySetCount++;
        continue;
      }

      if (!isDryRun) {
        await sequelize.query(
          `UPDATE inventory SET store_id = :storeId, updated_at = NOW() WHERE id = :itemId`,
          {
            replacements: {
              storeId: storeInfo.storeId,
              itemId: item.id
            }
          }
        );
        updatedCount++;
        console.log(`✅ Updated "${item.name}" → ${storeInfo.storeName}`);
      } else {
        console.log(`[DRY RUN] Would update "${item.name}" → ${storeInfo.storeName}`);
        updatedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total inventory items:     ${inventoryItems.length}`);
    console.log(`Updated:                   ${updatedCount}`);
    console.log(`Already set:               ${alreadySetCount}`);
    console.log(`Skipped (no store found):  ${skippedCount}`);
    console.log('='.repeat(50));

    if (isDryRun) {
      console.log('\n✅ Dry run completed - no data was written');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔌 PostgreSQL connection closed\n');
  }
}

// Run migration
addStoreIdToInventory();
