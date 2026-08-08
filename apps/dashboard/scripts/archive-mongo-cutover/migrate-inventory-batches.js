#!/usr/bin/env node

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Sequelize, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Sequelize (same as working migrate-inventory.js)
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

// Define InventoryBatch model inline
const InventoryBatch = sequelize.define('InventoryBatch', {
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
  userId: {
    type: DataTypes.UUID,
    field: 'user_id',
  },
  inventoryId: {
    type: DataTypes.UUID,
    field: 'inventory_id',
  },
  batchCode: {
    type: DataTypes.STRING(100),
    field: 'batch_code',
  },
  quantityIn: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'quantity_in',
  },
  quantitySold: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'quantity_sold',
  },
  quantityRemaining: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'quantity_remaining',
  },
  quantityReserved: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'quantity_reserved',
  },
  costPrice: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'cost_price',
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'selling_price',
  },
  dateReceived: {
    type: DataTypes.DATE,
    field: 'date_received',
  },
  expiryDate: {
    type: DataTypes.DATE,
    field: 'expiry_date',
  },
  supplier: DataTypes.STRING(255),
  notes: DataTypes.TEXT,
  status: {
    type: DataTypes.ENUM('active', 'expired', 'sold_out', 'depleted', 'archived'),
    defaultValue: 'active',
  },
  batchLocation: {
    type: DataTypes.STRING(255),
    field: 'batch_location',
  },
  archivedAt: {
    type: DataTypes.DATE,
    field: 'archived_at',
  },
}, {
  tableName: 'inventory_batches',
  underscored: true,
  timestamps: true,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BATCH_SIZE = 10;
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
  return map.get(objectIdStr) || generateUUID();
}

/**
 * Load user and inventory ID mappings from the database
 */
async function loadIdMappings() {
  try {
    // Load user ID mappings (MongoDB ID stored in preferences.mongodbId)
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
 * Transform MongoDB inventory batch document to PostgreSQL format
 */
function transformInventoryBatchData(mongoDoc) {
  const transformed = {
    id: generateUUID(),
    userId: convertObjectIdToUUID(mongoDoc.userId?.toString(), 'user'),
    inventoryId: convertObjectIdToUUID(mongoDoc.productId?.toString(), 'inventory'),
    mongoId: mongoDoc._id?.toString(),
    
    // Batch identification
    batchCode: mongoDoc.batchCode,
    
    // Variant tracking
    hasVariants: mongoDoc.hasVariants || false,
    variants: mongoDoc.variants && mongoDoc.variants.length > 0 ? JSON.stringify(mongoDoc.variants) : null,
    
    // Quantity tracking
    quantityIn: mongoDoc.quantityIn || 0,
    quantitySold: mongoDoc.quantitySold || 0,
    quantityRemaining: mongoDoc.quantityRemaining || 0,
    quantityReserved: mongoDoc.quantityReserved || 0,
    
    // Pricing information
    costPrice: mongoDoc.costPrice || 0,
    sellingPrice: mongoDoc.sellingPrice || 0,
    
    // Dates
    dateReceived: mongoDoc.dateReceived || new Date(),
    expiryDate: mongoDoc.expiryDate || null,
    
    // Additional information
    supplier: mongoDoc.supplier || '',
    notes: mongoDoc.notes || '',
    
    // Status tracking
    status: mongoDoc.status || 'active',
    batchLocation: mongoDoc.batchLocation || '',
    
    // Archive tracking
    archivedAt: mongoDoc.archivedAt || null,
    
    // Timestamps
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };

  return transformed;
}

/**
 * Migrate inventory batches from MongoDB to Supabase
 */
async function migrateInventoryBatches() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting inventory batch migration...');
    
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
    const batchCollection = mongoDb.collection('inventorybatches');
    
    // Get total count
    const totalCount = await batchCollection.countDocuments();
    console.log(`📊 Total inventory batches to migrate: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('✅ No inventory batches to migrate');
      return;
    }
    
    // Check PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Create table if it doesn't exist
    console.log('📋 Creating inventory_batches table if it doesn\'t exist...');
    await InventoryBatch.sync();
    console.log('✅ Table ready');
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process in batches
    const cursor = batchCollection.find({});
    
    while (await cursor.hasNext()) {
      const batch = [];
      
      // Collect batch
      for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
        batch.push(await cursor.next());
      }
      
      if (batch.length === 0) break;
      
      console.log(`🔄 Processing batch of ${batch.length} items...`);
      
      // Process batch
      for (const mongoDoc of batch) {
        try {
          const transformedData = transformInventoryBatchData(mongoDoc);
          
          // Validate required relationships
          if (!transformedData.userId) {
            throw new Error('User ID not found in mappings');
          }
          
          if (!transformedData.inventoryId && inventoryIdMap.size > 0) {
            console.log(`⚠️  Inventory ID not found for batch ${transformedData.batchCode}, skipping`);
            continue;
          }
          
          if (!isDryRun) {
            // Check for existing record
            const existing = await InventoryBatch.findOne({
              where: { mongoId: transformedData.mongoId }
            });
            
            if (existing) {
              console.log(`⚠️  Skipping existing batch: ${transformedData.batchCode}`);
              continue;
            }
            
            // Create new inventory batch record
            await InventoryBatch.create(transformedData);
          }
          
          migratedCount++;
          
          if (migratedCount % 10 === 0) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} inventory batches`);
          }
          
        } catch (error) {
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            batchCode: mongoDoc.batchCode,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating batch ${mongoDoc.batchCode}:`, error.message);
          
          // Continue with next record instead of stopping
          if (errorCount > 50) {
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
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${migratedCount + errorCount}/${totalCount}`);
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n❌ Error details:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.batchCode} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.batchCode} (${error.mongoId}): ${error.error}`);
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
    console.log('  node scripts/migrate-inventory-batches.js migrate [--dry-run]');
    console.log('  node scripts/migrate-inventory-batches.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateInventoryBatches();
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

export default { migrateInventoryBatches };