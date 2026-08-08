#!/usr/bin/env node

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Sequelize, DataTypes } from 'sequelize';

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
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define Inventory model inline
const Inventory = sequelize.define('Inventory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING,
    field: 'mongo_id',
    unique: true,
  },
  primaryImage: {
    type: DataTypes.TEXT,
    field: 'primary_image',
  },
}, {
  tableName: 'inventory',
  underscored: true,
  timestamps: true,
});

// MongoDB connection
const mongoUri = process.env.MONGODB_URI;
const mongoClient = new MongoClient(mongoUri);

// Statistics
const stats = {
  totalItems: 0,
  updatedCount: 0,
  skippedCount: 0,
  errorCount: 0,
  noImageCount: 0,
};

async function updatePrimaryImage(mongoItem) {
  try {
    // Find the corresponding Supabase inventory item by mongoId
    const inventoryItem = await Inventory.findOne({
      where: { mongoId: mongoItem._id.toString() }
    });

    if (!inventoryItem) {
      console.log(`⚠️  Skipped: Inventory item not found in Supabase for MongoDB ID: ${mongoItem._id}`);
      stats.skippedCount++;
      return;
    }

    // Check if item has a primary image in MongoDB
    if (!mongoItem.image) {
      console.log(`ℹ️  No primary image for: ${mongoItem.productName || 'Unknown'} (${mongoItem._id})`);
      stats.noImageCount++;
      return;
    }

    // Update the primary image field
    await inventoryItem.update({
      primaryImage: mongoItem.image
    });

    console.log(`✅ Updated primary image for: ${mongoItem.productName || 'Unknown'}`);
    stats.updatedCount++;

  } catch (error) {
    console.error(`❌ Error updating item ${mongoItem._id}:`, error.message);
    stats.errorCount++;
  }
}

async function runMigration() {
  console.log('🚀 Starting Primary Image Migration...\n');
  console.log('================================\n');

  try {
    // Test Supabase connection
    console.log('📊 Testing Supabase connection...');
    await sequelize.authenticate();
    console.log('✅ Supabase connected successfully\n');

    // Test MongoDB connection
    console.log('📊 Testing MongoDB connection...');
    await mongoClient.connect();
    const mongoDb = mongoClient.db('test');
    console.log('✅ MongoDB connected successfully\n');

    // Get MongoDB inventory collection
    const inventoryCollection = mongoDb.collection('inventories');

    // Count total items
    stats.totalItems = await inventoryCollection.countDocuments({
      isDeleted: { $ne: true }
    });
    console.log(`📦 Total inventory items to process: ${stats.totalItems}\n`);

    if (stats.totalItems === 0) {
      console.log('⚠️  No inventory items found in MongoDB. Exiting...\n');
      return;
    }

    // Process items in batches
    const BATCH_SIZE = 50;
    let processedCount = 0;

    const cursor = inventoryCollection.find({
      isDeleted: { $ne: true }
    });

    const items = [];
    for await (const item of cursor) {
      items.push(item);
      
      if (items.length >= BATCH_SIZE) {
        // Process batch
        for (const mongoItem of items) {
          await updatePrimaryImage(mongoItem);
          processedCount++;
          
          if (processedCount % 10 === 0) {
            console.log(`\n📊 Progress: ${processedCount}/${stats.totalItems} items processed\n`);
          }
        }
        items.length = 0; // Clear batch
      }
    }

    // Process remaining items
    for (const mongoItem of items) {
      await updatePrimaryImage(mongoItem);
      processedCount++;
    }

    // Final summary
    console.log('\n================================');
    console.log('🎉 Primary Image Migration Complete!\n');
    console.log('📊 Migration Summary:');
    console.log(`   Total items processed: ${stats.totalItems}`);
    console.log(`   ✅ Successfully updated: ${stats.updatedCount}`);
    console.log(`   ℹ️  No primary image: ${stats.noImageCount}`);
    console.log(`   ⚠️  Skipped (not found): ${stats.skippedCount}`);
    console.log(`   ❌ Errors: ${stats.errorCount}`);
    console.log('================================\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close connections
    await mongoClient.close();
    await sequelize.close();
    console.log('🔌 Database connections closed');
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
