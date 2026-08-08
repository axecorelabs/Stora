#!/usr/bin/env node

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Sequelize, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Sequelize (same as working scripts)
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

// Define InventoryActivity model inline
const InventoryActivity = sequelize.define('InventoryActivity', {
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
  inventoryId: {
    type: DataTypes.UUID,
    field: 'inventory_id',
  },
  userId: {
    type: DataTypes.UUID,
    field: 'user_id',
  },
  activityType: {
    type: DataTypes.ENUM(
      'stock_in',
      'stock_out',
      'sale',
      'adjustment',
      'transfer',
      'return',
      'damaged',
      'expired',
      'created',
      'updated',
      'stock_added',
      'stock_removed',
      'order_processed',
      'batch_update'
    ),
    allowNull: false,
    field: 'activity_type',
  },
  quantityBefore: {
    type: DataTypes.INTEGER,
    field: 'quantity_before',
  },
  quantityChanged: {
    type: DataTypes.INTEGER,
    field: 'quantity_changed',
  },
  quantityAfter: {
    type: DataTypes.INTEGER,
    field: 'quantity_after',
  },
  reason: DataTypes.TEXT,
  notes: DataTypes.TEXT,
  batchId: {
    type: DataTypes.UUID,
    field: 'batch_id',
  },
  batchCode: {
    type: DataTypes.STRING,
    field: 'batch_code',
  },
  relatedOrderId: {
    type: DataTypes.UUID,
    field: 'related_order_id',
  },
  relatedSaleId: {
    type: DataTypes.UUID,
    field: 'related_sale_id',
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'inventory_activities',
  underscored: true,
  timestamps: true,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BATCH_SIZE = 50; // Higher batch size for activity logs
const MONGODB_URI = process.env.MONGODB_URI;
const isDryRun = process.argv.includes('--dry-run');

// ID mapping caches
const userIdMap = new Map();
const inventoryIdMap = new Map();

/**
 * Helper function to generate UUID
 */
function generateUUID() {
  return uuidv4();
}

/**
 * Helper function to convert MongoDB ObjectId to UUID
 */
function convertObjectIdToUUID(objectIdStr, mapName = 'user') {
  if (!objectIdStr) return null;
  
  const map = mapName === 'inventory' ? inventoryIdMap : userIdMap;
  return map.get(objectIdStr) || null; // Return null if not found in mappings
}

/**
 * Load user and inventory ID mappings from the database
 */
async function loadIdMappings() {
  try {
    // Load user ID mappings
    const users = await sequelize.query(
      'SELECT preferences->>\'mongodbId\' as mongo_id, id FROM "users" WHERE preferences->>\'mongodbId\' IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    
    users.forEach(user => {
      userIdMap.set(user.mongo_id, user.id);
    });
    
    console.log(`📥 Loaded ${userIdMap.size} user ID mappings`);
    
    // Load inventory ID mappings
    const inventories = await sequelize.query(
      'SELECT mongo_id, id FROM "inventory" WHERE mongo_id IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    
    inventories.forEach(inventory => {
      inventoryIdMap.set(inventory.mongo_id, inventory.id);
    });
    
    console.log(`📥 Loaded ${inventoryIdMap.size} inventory ID mappings`);
    
  } catch (error) {
    console.error('❌ Error loading ID mappings:', error);
    throw error;
  }
}

/**
 * Transform MongoDB inventory activity document to PostgreSQL format
 */
function transformInventoryActivityData(mongoDoc) {
  const userId = convertObjectIdToUUID(mongoDoc.userId?.toString(), 'user');
  const inventoryId = convertObjectIdToUUID(mongoDoc.inventoryId?.toString(), 'inventory');
  
  // Skip if required relationships are missing
  if (!userId || !inventoryId) {
    return null;
  }
  
  const transformed = {
    id: generateUUID(),
    userId: userId,
    inventoryId: inventoryId,
    mongoId: mongoDoc._id?.toString(),
    
    // Activity details
    activityType: mongoDoc.activityType,
    description: mongoDoc.description || '',
    
    // Change tracking
    changes: mongoDoc.changes ? JSON.stringify(mongoDoc.changes) : null,
    previousValues: mongoDoc.previousValues ? JSON.stringify(mongoDoc.previousValues) : null,
    newValues: mongoDoc.newValues ? JSON.stringify(mongoDoc.newValues) : null,
    
    // Stock movement specific data
    stockMovement: mongoDoc.stockMovement ? JSON.stringify(mongoDoc.stockMovement) : null,
    
    // Additional metadata
    metadata: mongoDoc.metadata ? JSON.stringify(mongoDoc.metadata) : null,
    
    // User agent and IP for audit trail
    userAgent: mongoDoc.userAgent || null,
    ipAddress: mongoDoc.ipAddress || null,
    
    // Timestamps
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };

  return transformed;
}

/**
 * Migrate inventory activities from MongoDB to Supabase
 */
async function migrateInventoryActivities() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting inventory activity migration...');
    
    // Load ID mappings
    await loadIdMappings();
    
    if (userIdMap.size === 0) {
      throw new Error('No user ID mappings found. Please run user migration first.');
    }
    
    if (inventoryIdMap.size === 0) {
      console.log('⚠️  No inventory ID mappings found. Inventory migration may be needed first.');
    }
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    
    const mongoDb = mongoClient.db();
    const activityCollection = mongoDb.collection('inventoryactivities');
    
    // Get total count
    const totalCount = await activityCollection.countDocuments();
    console.log(`📊 Total inventory activities to migrate: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('✅ No inventory activities to migrate');
      return;
    }
    
    // Check PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Create table if it doesn't exist
    console.log('📋 Creating inventory_activities table if it doesn\'t exist...');
    await InventoryActivity.sync();
    console.log('✅ Table ready');
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
    }
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process in batches
    const cursor = activityCollection.find({}).sort({ createdAt: 1 }); // Maintain chronological order
    
    while (await cursor.hasNext()) {
      const batch = [];
      
      // Collect batch
      for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
        batch.push(await cursor.next());
      }
      
      if (batch.length === 0) break;
      
      console.log(`🔄 Processing batch of ${batch.length} activities...`);
      
      // Process batch
      for (const mongoDoc of batch) {
        try {
          const transformedData = transformInventoryActivityData(mongoDoc);
          
          // Skip if transformation failed (missing relationships)
          if (!transformedData) {
            skippedCount++;
            continue;
          }
          
          if (!isDryRun) {
            // Check for existing record
            const existing = await InventoryActivity.findOne({
              where: { mongoId: transformedData.mongoId }
            });
            
            if (existing) {
              skippedCount++;
              continue;
            }
            
            // Create new inventory activity record
            await InventoryActivity.create(transformedData);
          }
          
          migratedCount++;
          
          if (migratedCount % 50 === 0) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} inventory activities`);
          }
          
        } catch (error) {
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            activityType: mongoDoc.activityType,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating activity ${mongoDoc._id}:`, error.message);
          
          // Continue with next record instead of stopping
          if (errorCount > 100) {
            console.error('❌ Too many errors, stopping migration');
            break;
          }
        }
      }
    }
    
    await cursor.close();
    
    // Summary
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (missing relationships): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${migratedCount + skippedCount + errorCount}/${totalCount}`);
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n❌ Error details:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.activityType} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.activityType} (${error.mongoId}): ${error.error}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  } finally {
    try {
      if (mongoClient) {
        await mongoClient.close();
        console.log('📝 MongoDB connection closed');
      }
      await sequelize.close();
      console.log('📝 PostgreSQL connection closed');
    } catch (closeError) {
      console.error('Error closing connections:', closeError);
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
    console.log('  node scripts/migrate-inventory-activities.js migrate [--dry-run]');
    console.log('  node scripts/migrate-inventory-activities.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateInventoryActivities();
  } else {
    console.error('❌ Unknown command:', command);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

export default { migrateInventoryActivities };