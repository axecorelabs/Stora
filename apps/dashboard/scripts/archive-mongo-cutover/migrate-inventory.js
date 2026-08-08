#!/usr/bin/env node

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Sequelize, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Initialize Sequelize (same as working migrate-users-simple.js)
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

// Define Inventory model inline (avoiding complex index.js imports)
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: DataTypes.TEXT,
  category: DataTypes.STRING(100),
  categoryDetails: {
    type: DataTypes.JSONB,
    field: 'category_details',
  },
  variants: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  hasVariants: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'has_variants',
  },
  unitOfMeasure: {
    type: DataTypes.STRING(50),
    defaultValue: 'Piece',
    field: 'unit_of_measure',
  },
  basePrice: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'base_price',
  },
  cost: DataTypes.DECIMAL(12, 2),
  sku: DataTypes.STRING(100),
  barcode: DataTypes.STRING(100),
  stockQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'stock_quantity',
  },
  minimumStock: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'minimum_stock',
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    defaultValue: [],
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  userId: {
    type: DataTypes.UUID,
    field: 'user_id',
  },
}, {
  tableName: 'inventory',
  underscored: true,
  timestamps: true,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BATCH_SIZE = 10;
const MONGODB_URI = process.env.MONGODB_URI;
const isDryRun = process.argv.includes('--dry-run');

// User ID mapping cache (loaded from previous migration)
const userIdMap = new Map();

/**
 * Helper function to generate UUID
 */
function generateUUID() {
  return uuidv4();
}

/**
 * Helper function to convert MongoDB ObjectId to UUID
 */
function convertObjectIdToUUID(objectIdStr) {
  if (!objectIdStr) return null;
  return userIdMap.get(objectIdStr) || generateUUID();
}

/**
 * Load user ID mappings from the database
 */
async function loadUserIdMappings() {
  try {
    // Test Sequelize connection (same as working script)
    console.log('🔗 Testing Supabase connection...');
    await sequelize.authenticate();
    console.log('✅ Connected to Supabase\n');
    
    // The user migration stored MongoDB ID in preferences.mongodbId, not mongo_id column
    const users = await sequelize.query(
      'SELECT preferences->>\'mongodbId\' as mongo_id, id FROM "users" WHERE preferences->>\'mongodbId\' IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    
    users.forEach(user => {
      userIdMap.set(user.mongo_id, user.id);
    });
    
    console.log(`📥 Loaded ${userIdMap.size} user ID mappings`);
  } catch (error) {
    console.error('❌ Error loading user ID mappings:', error);
    throw error;
  }
}

/**
 * Transform MongoDB inventory document to PostgreSQL format
 */
function transformInventoryData(mongoDoc) {
  const transformed = {
    id: generateUUID(),
    userId: convertObjectIdToUUID(mongoDoc.userId?.toString()),
    mongoId: mongoDoc._id?.toString(),
    
    // Basic product information
    name: mongoDoc.productName || mongoDoc.name, // Map to 'name' field
    category: mongoDoc.category,
    sku: mongoDoc.sku,
    description: mongoDoc.description || '',
    brand: mongoDoc.brand || '',
    unitOfMeasure: mongoDoc.unitOfMeasure || 'Piece',
    
    // Quantity tracking
    stockQuantity: mongoDoc.quantityInStock || 0,
    minimumStock: mongoDoc.reorderLevel || 5,
    
    // Pricing
    basePrice: mongoDoc.sellingPrice || 0,
    cost: mongoDoc.costPrice || 0,
    
    // Additional information
    supplier: mongoDoc.supplier || '',
    location: mongoDoc.location || 'Main Store',
    qrCode: mongoDoc.qrCode || '',
    
    // Variants
    hasVariants: mongoDoc.hasVariants || false,
    variants: mongoDoc.variants ? JSON.stringify(mongoDoc.variants) : null,
    
    // Images
    images: Array.isArray(mongoDoc.images) ? mongoDoc.images : [],
    image: mongoDoc.image || null,
    notes: mongoDoc.notes || '',
    
    // Status
    status: mongoDoc.status || 'Active',
    webVisibility: mongoDoc.webVisibility !== undefined ? mongoDoc.webVisibility : true,
    
    // Category-specific details (stored as JSON)
    clothingDetails: mongoDoc.clothingDetails ? JSON.stringify(mongoDoc.clothingDetails) : null,
    shoesDetails: mongoDoc.shoesDetails ? JSON.stringify(mongoDoc.shoesDetails) : null,
    accessoriesDetails: mongoDoc.accessoriesDetails ? JSON.stringify(mongoDoc.accessoriesDetails) : null,
    perfumeDetails: mongoDoc.perfumeDetails ? JSON.stringify(mongoDoc.perfumeDetails) : null,
    foodDetails: mongoDoc.foodDetails ? JSON.stringify(mongoDoc.foodDetails) : null,
    beveragesDetails: mongoDoc.beveragesDetails ? JSON.stringify(mongoDoc.beveragesDetails) : null,
    electronicsDetails: mongoDoc.electronicsDetails ? JSON.stringify(mongoDoc.electronicsDetails) : null,
    booksDetails: mongoDoc.booksDetails ? JSON.stringify(mongoDoc.booksDetails) : null,
    homeGardenDetails: mongoDoc.homeGardenDetails ? JSON.stringify(mongoDoc.homeGardenDetails) : null,
    sportsDetails: mongoDoc.sportsDetails ? JSON.stringify(mongoDoc.sportsDetails) : null,
    automotiveDetails: mongoDoc.automotiveDetails ? JSON.stringify(mongoDoc.automotiveDetails) : null,
    healthBeautyDetails: mongoDoc.healthBeautyDetails ? JSON.stringify(mongoDoc.healthBeautyDetails) : null,
    
    // Tags
    tags: Array.isArray(mongoDoc.tags) ? mongoDoc.tags : [],
    
    // Deletion tracking
    isDeleted: mongoDoc.isDeleted || false,
    deletedAt: mongoDoc.deletedAt,
    deletedBy: mongoDoc.deletedBy ? convertObjectIdToUUID(mongoDoc.deletedBy.toString()) : null,
    deletionReason: mongoDoc.deletionReason || '',
    
    // Timestamps
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
    lastUpdated: mongoDoc.lastUpdated || new Date()
  };

  return transformed;
}

/**
 * Migrate inventory from MongoDB to Supabase
 */
async function migrateInventory() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting inventory migration...');
    
    // Load user ID mappings
    await loadUserIdMappings();
    
    if (userIdMap.size === 0) {
      throw new Error('No user ID mappings found. Please run user migration first.');
    }
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    
    const mongoDb = mongoClient.db();
    const inventoryCollection = mongoDb.collection('inventories');
    
    // Get total count
    const totalCount = await inventoryCollection.countDocuments();
    console.log(`📊 Total inventory items to migrate: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('✅ No inventory items to migrate');
      return;
    }
    
    // Check PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Create table if it doesn't exist
    console.log('📋 Creating inventory table if it doesn\'t exist...');
    await Inventory.sync();
    console.log('✅ Table ready');
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process in batches
    const cursor = inventoryCollection.find({});
    
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
          const transformedData = transformInventoryData(mongoDoc);
          
          if (!isDryRun) {
            // Check for existing record
            const existing = await Inventory.findOne({
              where: { mongoId: transformedData.mongoId }
            });
            
            if (existing) {
              // Update existing item with corrected data including unitOfMeasure
              await existing.update({
                stockQuantity: transformedData.stockQuantity,
                minimumStock: transformedData.minimumStock,
                basePrice: transformedData.basePrice,
                cost: transformedData.cost,
                unitOfMeasure: transformedData.unitOfMeasure,
                hasVariants: transformedData.hasVariants,
                variants: transformedData.variants,
                images: transformedData.images
              });
              console.log(`🔄 Updated inventory: ${transformedData.name}`);
            } else {
              // Create new inventory record
              await Inventory.create(transformedData);
              console.log(`✅ Created inventory: ${transformedData.name}`);
            }
          }
          
          migratedCount++;
          
          if (migratedCount % 10 === 0) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} inventory items`);
          }
          
        } catch (error) {
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            productName: mongoDoc.productName,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating inventory ${mongoDoc.productName}:`, error.message);
          
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
        console.log(`${index + 1}. ${error.productName} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.productName} (${error.mongoId}): ${error.error}`);
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
    console.log('  node scripts/migrate-inventory.js migrate [--dry-run]');
    console.log('  node scripts/migrate-inventory.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateInventory();
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

export default { migrateInventory };