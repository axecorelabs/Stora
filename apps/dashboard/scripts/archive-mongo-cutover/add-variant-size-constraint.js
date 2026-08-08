#!/usr/bin/env node

/**
 * Database Migration: Add NOT NULL constraint with default 'One Size' to variant size field
 * 
 * Purpose:
 * - Prevent NULL values in the size field of inventory variants
 * - Set default value of 'One Size' for any existing or new variants without a size
 * - Ensures data integrity across all variant records
 * 
 * Run this script once to update the database schema.
 */

import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function addSizeConstraint() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Start transaction
    await client.query('BEGIN');

    // Step 1: Check for NULL or empty sizes in inventory_variants table
    console.log('\n📝 Checking for NULL or empty sizes...');
    
    const checkResult = await client.query(`
      SELECT COUNT(*) as count
      FROM inventory_variants
      WHERE size IS NULL OR size = '';
    `);

    const nullSizeCount = parseInt(checkResult.rows[0].count);
    console.log(`   Found ${nullSizeCount} variants with NULL or empty sizes`);

    if (nullSizeCount > 0) {
      // Update NULL or empty sizes to 'One Size'
      const updateResult = await client.query(`
        UPDATE inventory_variants
        SET size = 'One Size'
        WHERE size IS NULL OR size = '';
      `);

      console.log(`   Updated ${updateResult.rowCount} variant records to "One Size"`);
    } else {
      console.log(`   No NULL or empty sizes found - skipping update`);
    }

    // Step 2: Add NOT NULL constraint with default value
    console.log('\n📝 Adding NOT NULL constraint to size column...');
    
    await client.query(`
      ALTER TABLE inventory_variants 
      ALTER COLUMN size SET DEFAULT 'One Size';
    `);

    await client.query(`
      ALTER TABLE inventory_variants 
      ALTER COLUMN size SET NOT NULL;
    `);

    console.log('   ✅ Constraint added successfully');

    // Step 3: Add validation function (optional, for extra safety)
    console.log('\n📝 Creating validation function...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_variant_size()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Ensure size is not empty string
        IF NEW.size IS NULL OR NEW.size = '' THEN
          NEW.size := 'One Size';
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('   ✅ Validation function created');

    // Step 4: Create trigger to enforce validation
    console.log('\n📝 Creating validation trigger...');
    
    await client.query(`
      DROP TRIGGER IF EXISTS ensure_variant_size ON inventory_variants;
    `);

    await client.query(`
      CREATE TRIGGER ensure_variant_size
      BEFORE INSERT OR UPDATE ON inventory_variants
      FOR EACH ROW
      EXECUTE FUNCTION validate_variant_size();
    `);

    console.log('   ✅ Validation trigger created');

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   ✓ Updated ${nullSizeCount} existing NULL/empty sizes to "One Size"`);
    console.log('   ✓ Added NOT NULL constraint to size column');
    console.log('   ✓ Added default value "One Size" to size column');
    console.log('   ✓ Created validation function to prevent empty sizes');
    console.log('   ✓ Created trigger to enforce validation on INSERT/UPDATE');
    console.log('\n🎯 All variant sizes must now be non-NULL. Default: "One Size"');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migration
async function runMigration() {
  try {
    await addSizeConstraint();
    console.log('\n✅ Migration script completed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  }
}

runMigration();
