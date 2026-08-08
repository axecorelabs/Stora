#!/usr/bin/env node

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Sequelize, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
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

// Configuration
const BATCH_SIZE = 50;
const MONGODB_URI = process.env.MONGODB_URI;
const isDryRun = process.argv.includes('--dry-run');

// ID mapping cache for users
const userIdMap = new Map();

// Load user ID mappings
async function loadUserIdMappings() {
  try {
    const users = await sequelize.query(
      'SELECT preferences->>\'mongodbId\' as mongo_id, id FROM "users" WHERE preferences->>\'mongodbId\' IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    users.forEach(user => userIdMap.set(user.mongo_id, user.id));
    console.log(`📥 Loaded ${userIdMap.size} user ID mappings`);
  } catch (error) {
    console.error('❌ Error loading user ID mappings:', error);
    throw error;
  }
}

function convertUserObjectIdToUUID(objectIdStr) {
  if (!objectIdStr) return null;
  return userIdMap.get(objectIdStr) || null;
}

// Define Store model (inline for migration)
const Store = sequelize.define('Store', {
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
  ownerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'owner_id',
  },
  storeName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'store_name',
  },
  storeSlug: {
    type: DataTypes.STRING(255),
    unique: true,
    field: 'store_slug',
  },
  storeDescription: {
    type: DataTypes.TEXT,
    field: 'store_description',
  },
  storeType: {
    type: DataTypes.ENUM('physical', 'online', 'both'),
    defaultValue: 'physical',
    field: 'store_type',
  },
  storePhone: {
    type: DataTypes.STRING(20),
    field: 'store_phone',
  },
  storeEmail: {
    type: DataTypes.STRING(255),
    field: 'store_email',
  },
  address: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  onlineStoreInfo: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'online_store_info',
  },
  branding: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  businessHours: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'business_hours',
  },
  settings: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  bankDetails: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'bank_details',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_verified',
  },
  verificationStatus: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending',
    field: 'verification_status',
  },
  totalSales: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_sales',
  },
  totalOrders: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_orders',
  },
  averageRating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0,
    field: 'average_rating',
  },
  totalReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_reviews',
  },
  // IVMA Website fields
  ivmaWebsite: {
    type: DataTypes.JSONB,
    defaultValue: {},
    field: 'ivma_website',
  },
}, {
  tableName: 'stores',
  underscored: true,
  timestamps: true,
});

// Transform MongoDB store to PostgreSQL structure
function transformStoreData(mongoDoc) {
  const storeId = uuidv4();
  
  // Generate slug from store name
  const generateSlug = (name) => {
    if (!name) return null;
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const storeData = {
    id: storeId,
    mongoId: mongoDoc._id?.toString(),
    ownerId: convertUserObjectIdToUUID(mongoDoc.userId?.toString()),
    storeName: mongoDoc.storeName || '',
    storeSlug: generateSlug(mongoDoc.storeName),
    storeDescription: mongoDoc.storeDescription || '',
    storeType: mongoDoc.storeType || 'physical',
    storePhone: mongoDoc.storePhone || '',
    storeEmail: mongoDoc.storeEmail || '',
    
    // Address information
    address: {
      street: mongoDoc.address?.street || '',
      city: mongoDoc.address?.city || '',
      state: mongoDoc.address?.state || '',
      country: mongoDoc.address?.country || 'Nigeria',
      postalCode: mongoDoc.address?.postalCode || '',
    },
    
    // Online store information
    onlineStoreInfo: {
      website: mongoDoc.onlineStoreInfo?.website || '',
      socialMedia: {
        instagram: mongoDoc.onlineStoreInfo?.socialMedia?.instagram || '',
        facebook: mongoDoc.onlineStoreInfo?.socialMedia?.facebook || '',
        twitter: mongoDoc.onlineStoreInfo?.socialMedia?.twitter || '',
        whatsapp: mongoDoc.onlineStoreInfo?.socialMedia?.whatsapp || '',
      },
      deliveryAreas: mongoDoc.onlineStoreInfo?.deliveryAreas || [],
    },
    
    // Store branding
    branding: {
      logo: mongoDoc.branding?.logo || '',
      banner: mongoDoc.branding?.banner || '',
      primaryColor: mongoDoc.branding?.primaryColor || '#0D9488',
      secondaryColor: mongoDoc.branding?.secondaryColor || '#F3F4F6',
    },
    
    // Business hours (if exists)
    businessHours: mongoDoc.businessHours || {},
    
    // Store settings
    settings: {
      currency: mongoDoc.settings?.currency || 'NGN',
      timezone: mongoDoc.settings?.timezone || 'Africa/Lagos',
      taxRate: mongoDoc.settings?.taxRate || 0,
      defaultDiscount: mongoDoc.settings?.defaultDiscount || 0,
      receiptFooter: mongoDoc.settings?.receiptFooter || 'Thank you for your business!',
      allowNegativeStock: mongoDoc.settings?.allowNegativeStock || false,
      autoGenerateReceipts: mongoDoc.settings?.autoGenerateReceipts || true,
      allowOnlineOrders: true,
      autoAcceptOrders: false,
      requireCustomerVerification: false,
      minOrderAmount: 0,
      deliveryRadius: 10,
      estimatedDeliveryTime: 60,
    },
    
    // Bank details (may be empty)
    bankDetails: mongoDoc.bankDetails || {},
    
    // Status fields
    isActive: mongoDoc.isActive !== false, // Default to true
    isVerified: mongoDoc.isVerified || false,
    verificationStatus: 'pending', // Reset verification status
    
    // Performance metrics
    totalSales: mongoDoc.totalSales || 0,
    totalOrders: mongoDoc.totalOrders || 0,
    averageRating: mongoDoc.averageRating || 0,
    totalReviews: mongoDoc.totalReviews || 0,
    
    // IVMA Website information
    ivmaWebsite: {
      websitePath: mongoDoc.ivmaWebsite?.websitePath || '',
      status: mongoDoc.ivmaWebsite?.status || 'inactive',
      isEnabled: mongoDoc.ivmaWebsite?.isEnabled || false,
      seoSettings: mongoDoc.ivmaWebsite?.seoSettings || {},
      customization: mongoDoc.ivmaWebsite?.customization || {},
      analytics: mongoDoc.ivmaWebsite?.analytics || {},
      metrics: mongoDoc.ivmaWebsite?.metrics || {
        totalViews: 0,
        monthlyViews: 0,
        lastVisit: null,
        totalOrders: 0
      },
      domain: mongoDoc.ivmaWebsite?.domain || {},
      activatedAt: mongoDoc.ivmaWebsite?.activatedAt || null,
      suspendedAt: mongoDoc.ivmaWebsite?.suspendedAt || null,
      lastPublishedAt: mongoDoc.ivmaWebsite?.lastPublishedAt || null,
      statusReason: mongoDoc.ivmaWebsite?.statusReason || '',
      settings: mongoDoc.ivmaWebsite?.settings || {}
    },
    
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
  };

  return storeData;
}

async function migrateStores() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting store migration...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Load user ID mappings
    await loadUserIdMappings();
    
    // Create tables if they don't exist
    console.log('📋 Creating stores table...');
    await Store.sync({ force: false });
    console.log('✅ Stores table ready');
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('✅ MongoDB connection successful');
    
    // Get total count
    const totalCount = await db.collection('stores').countDocuments();
    console.log(`📊 Found ${totalCount} stores to migrate`);
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
      
      // Show sample transformation
      const sampleDocs = await db.collection('stores').find({}).limit(3).toArray();
      for (const doc of sampleDocs) {
        const transformed = transformStoreData(doc);
        console.log('\n📄 Sample transformation:');
        console.log(`MongoDB Store: ${doc.storeName} (${doc.storeType})`);
        console.log(`PostgreSQL Store: ${transformed.storeName}`);
        console.log(`Owner mapping: ${doc.userId} -> ${transformed.ownerId}`);
        console.log(`Address: ${transformed.address.city}, ${transformed.address.state}`);
      }
      
      return;
    }
    
    // Check for existing data
    const existingCount = await Store.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing stores. Skipping duplicates by mongoId.`);
    }
    
    // Process stores in batches
    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const cursor = db.collection('stores').find({});
    const stores = await cursor.toArray();
    
    for (let i = 0; i < stores.length; i += BATCH_SIZE) {
      const batch = stores.slice(i, i + BATCH_SIZE);
      
      for (const mongoDoc of batch) {
        try {
          processedCount++;
          
          // Skip if already exists
          const existing = await Store.findOne({ where: { mongoId: mongoDoc._id?.toString() } });
          if (existing) {
            console.log(`⏭️  Skipping existing store: ${mongoDoc.storeName}`);
            skippedCount++;
            continue;
          }
          
          const transformedData = transformStoreData(mongoDoc);
          
          // Skip if no valid owner mapping found
          if (!transformedData.ownerId) {
            console.log(`⏭️  Skipping store with no owner mapping: ${mongoDoc.storeName}`);
            skippedCount++;
            continue;
          }
          
          // Create store
          await Store.create(transformedData);
          
          migratedCount++;
          
          if (migratedCount % 10 === 0 || migratedCount === totalCount) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} stores`);
          }
          
        } catch (error) {
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            storeName: mongoDoc.storeName,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating store ${mongoDoc.storeName}:`, error.message);
          
          if (errorCount > 10) {
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
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${processedCount}/${totalCount}`);
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n❌ Error details:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.storeName} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.storeName} (${error.mongoId}): ${error.error}`);
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
    console.log('  node scripts/migrate-stores.js migrate [--dry-run]');
    console.log('  node scripts/migrate-stores.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateStores();
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

export default { Store };