#!/usr/bin/env node

import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
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

async function addInventoryFields() {
  try {
    console.log('🚀 Starting inventory fields migration...\n');

    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written\n');
    }

    // Test connection
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established\n');

    // Check existing columns
    const [existingColumns] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory'
    `);

    const columnNames = existingColumns.map(col => col.column_name);
    console.log('📊 Current inventory columns:', columnNames.length);

    const fieldsToAdd = [];

    // Check web_visibility
    if (!columnNames.includes('web_visibility')) {
      fieldsToAdd.push({
        name: 'web_visibility',
        sql: 'ALTER TABLE inventory ADD COLUMN web_visibility BOOLEAN DEFAULT true NOT NULL'
      });
    }

    // Check is_deleted
    if (!columnNames.includes('is_deleted')) {
      fieldsToAdd.push({
        name: 'is_deleted',
        sql: 'ALTER TABLE inventory ADD COLUMN is_deleted BOOLEAN DEFAULT false NOT NULL'
      });
    }

    // Check deleted_at
    if (!columnNames.includes('deleted_at')) {
      fieldsToAdd.push({
        name: 'deleted_at',
        sql: 'ALTER TABLE inventory ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE'
      });
    }

    // Check deleted_by
    if (!columnNames.includes('deleted_by')) {
      fieldsToAdd.push({
        name: 'deleted_by',
        sql: 'ALTER TABLE inventory ADD COLUMN deleted_by UUID REFERENCES users(id) ON DELETE SET NULL'
      });
    }

    // Check deletion_reason
    if (!columnNames.includes('deletion_reason')) {
      fieldsToAdd.push({
        name: 'deletion_reason',
        sql: 'ALTER TABLE inventory ADD COLUMN deletion_reason TEXT'
      });
    }

    if (fieldsToAdd.length === 0) {
      console.log('ℹ️  All fields already exist in the inventory table\n');
      return;
    }

    console.log(`\n📝 Fields to add: ${fieldsToAdd.length}\n`);

    for (const field of fieldsToAdd) {
      console.log(`Adding column: ${field.name}...`);
      
      if (!isDryRun) {
        await sequelize.query(field.sql);
        console.log(`✅ Added ${field.name}`);
      } else {
        console.log(`[DRY RUN] Would add ${field.name}`);
      }
    }

    // Add indexes
    console.log('\n📇 Adding indexes...');

    const indexesToAdd = [
      {
        name: 'idx_inventory_web_visibility',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventory_web_visibility ON inventory(web_visibility)',
        check: 'web_visibility'
      },
      {
        name: 'idx_inventory_is_deleted',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventory_is_deleted ON inventory(is_deleted)',
        check: 'is_deleted'
      },
      {
        name: 'idx_inventory_deleted_by',
        sql: 'CREATE INDEX IF NOT EXISTS idx_inventory_deleted_by ON inventory(deleted_by)',
        check: 'deleted_by'
      }
    ];

    for (const index of indexesToAdd) {
      if (columnNames.includes(index.check) || fieldsToAdd.some(f => f.name === index.check)) {
        console.log(`Creating index: ${index.name}...`);
        
        if (!isDryRun) {
          await sequelize.query(index.sql);
          console.log(`✅ Created ${index.name}`);
        } else {
          console.log(`[DRY RUN] Would create ${index.name}`);
        }
      }
    }

    // Get count of inventory items
    const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM inventory');
    const inventoryCount = parseInt(countResult[0].count);

    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Fields added:           ${fieldsToAdd.length}`);
    console.log(`Indexes created:        ${indexesToAdd.length}`);
    console.log(`Total inventory items:  ${inventoryCount}`);
    console.log('='.repeat(50));

    if (isDryRun) {
      console.log('\n✅ Dry run completed - no data was written');
    } else {
      console.log('\n✅ Migration completed successfully!');
      console.log('\nNew fields:');
      console.log('  - web_visibility: Controls product visibility on website');
      console.log('  - is_deleted: Soft delete flag');
      console.log('  - deleted_at: Deletion timestamp');
      console.log('  - deleted_by: User who deleted the item');
      console.log('  - deletion_reason: Reason for deletion');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('\n🔌 PostgreSQL connection closed\n');
  }
}

// Run migration
addInventoryFields();
