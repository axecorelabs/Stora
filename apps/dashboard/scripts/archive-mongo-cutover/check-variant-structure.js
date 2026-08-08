#!/usr/bin/env node

import dotenv from 'dotenv';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function checkVariantStructure() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Get sample variants data
    const result = await client.query(`
      SELECT id, name, variants, jsonb_typeof(variants) as variant_type
      FROM inventory 
      WHERE variants IS NOT NULL 
      LIMIT 10;
    `);

    console.log('📊 Sample variant structures:\n');
    
    for (const row of result.rows) {
      console.log(`Product: ${row.name}`);
      console.log(`Variants type: ${row.variant_type}`);
      
      // Parse if it's a string
      let variantsData = row.variants;
      if (typeof variantsData === 'string') {
        try {
          variantsData = JSON.parse(variantsData);
        } catch (e) {
          console.log('Could not parse variants');
        }
      }
      
      console.log(`Variants:`, JSON.stringify(variantsData, null, 2));
      console.log('-'.repeat(50));
    }

    if (result.rows.length === 0) {
      console.log('ℹ️  No products found');
    }
    
    // Check for any non-empty variants
    const nonEmptyResult = await client.query(`
      SELECT COUNT(*) as count
      FROM inventory 
      WHERE variants IS NOT NULL 
      AND jsonb_typeof(variants) = 'array'
      AND jsonb_array_length(variants) > 0;
    `);
    
    console.log(`\n📊 Products with non-empty variants: ${nonEmptyResult.rows[0].count}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkVariantStructure();
