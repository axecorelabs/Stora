#!/usr/bin/env node

import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
  },
  logging: console.log,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

async function addPrimaryImageColumn() {
  console.log('🚀 Starting Database Migration: Add primary_image column\n');
  console.log('================================\n');

  try {
    // Test connection
    console.log('📊 Testing Supabase connection...');
    await sequelize.authenticate();
    console.log('✅ Supabase connected successfully\n');

    // Check if column exists
    console.log('🔍 Checking if primary_image column exists...');
    const [results] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'inventory' 
      AND column_name = 'primary_image';
    `);

    if (results.length > 0) {
      console.log('✅ Column primary_image already exists. No action needed.\n');
      return;
    }

    console.log('📝 Column does not exist. Adding primary_image column...\n');

    // Add the primary_image column
    await sequelize.query(`
      ALTER TABLE inventory 
      ADD COLUMN IF NOT EXISTS primary_image TEXT;
    `);

    console.log('✅ Successfully added primary_image column\n');

    // Create an index for better query performance
    console.log('📝 Creating index on primary_image...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_inventory_primary_image 
      ON inventory(primary_image) 
      WHERE primary_image IS NOT NULL;
    `);

    console.log('✅ Successfully created index\n');

    // Verify the column was added
    console.log('🔍 Verifying column addition...');
    const [verifyResults] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'inventory' 
      AND column_name = 'primary_image';
    `);

    if (verifyResults.length > 0) {
      console.log('✅ Column verified:');
      console.log(`   Name: ${verifyResults[0].column_name}`);
      console.log(`   Type: ${verifyResults[0].data_type}`);
      console.log(`   Nullable: ${verifyResults[0].is_nullable}`);
      console.log('');
    }

    console.log('================================');
    console.log('🎉 Migration Complete!\n');
    console.log('✅ The primary_image column has been added to the inventory table.');
    console.log('✅ You can now run migrate-primary-images.js to populate the data.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run migration
addPrimaryImageColumn()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
