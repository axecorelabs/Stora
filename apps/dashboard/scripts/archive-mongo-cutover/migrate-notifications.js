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

// ID mapping caches
const userIdMap = new Map();
const inventoryIdMap = new Map();

// Load ID mappings
async function loadIdMappings() {
  try {
    // Load user ID mappings
    const users = await sequelize.query(
      'SELECT preferences->>\'mongodbId\' as mongo_id, id FROM "users" WHERE preferences->>\'mongodbId\' IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    users.forEach(user => userIdMap.set(user.mongo_id, user.id));
    console.log(`📥 Loaded ${userIdMap.size} user ID mappings`);
    
    // Load inventory ID mappings  
    const inventories = await sequelize.query(
      'SELECT mongo_id, id FROM "inventory" WHERE mongo_id IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    inventories.forEach(inv => inventoryIdMap.set(inv.mongo_id, inv.id));
    console.log(`📥 Loaded ${inventoryIdMap.size} inventory ID mappings`);
    
  } catch (error) {
    console.error('❌ Error loading ID mappings:', error);
    throw error;
  }
}

function convertObjectIdToUUID(objectIdStr, mapName = 'user') {
  if (!objectIdStr) return null;
  
  const maps = {
    user: userIdMap,
    inventory: inventoryIdMap,
  };
  
  const map = maps[mapName];
  return map?.get(objectIdStr) || null;
}

// Define Notification model (inline for migration)
const Notification = sequelize.define('Notification', {
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
    allowNull: false,
    field: 'user_id',
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('info', 'success', 'warning', 'error', 'inventory', 'system'),
    defaultValue: 'info',
  },
  relatedEntityType: {
    type: DataTypes.ENUM('inventory', 'order', 'user', 'subscription', 'system'),
    field: 'related_entity_type',
  },
  relatedEntityId: {
    type: DataTypes.UUID,
    field: 'related_entity_id',
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_read',
  },
  readAt: {
    type: DataTypes.DATE,
    field: 'read_at',
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  autoDismiss: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'auto_dismiss',
  },
  dismissAt: {
    type: DataTypes.DATE,
    field: 'dismiss_at',
  },
}, {
  tableName: 'notifications',
  underscored: true,
  timestamps: true,
});

// Transform MongoDB notification to PostgreSQL structure
function transformNotificationData(mongoDoc) {
  const notificationData = {
    id: uuidv4(),
    mongoId: mongoDoc._id?.toString(),
    userId: convertObjectIdToUUID(mongoDoc.userId?.toString(), 'user'),
    title: mongoDoc.title || '',
    message: mongoDoc.message || '',
    type: mongoDoc.type || 'info',
    relatedEntityType: mongoDoc.relatedEntityType || null,
    relatedEntityId: mongoDoc.relatedEntityType === 'inventory' 
      ? convertObjectIdToUUID(mongoDoc.relatedEntityId?.toString(), 'inventory')
      : mongoDoc.relatedEntityId ? mongoDoc.relatedEntityId.toString() : null,
    isRead: mongoDoc.isRead || false,
    readAt: mongoDoc.readAt || null,
    data: mongoDoc.data || {},
    autoDismiss: mongoDoc.autoDismiss || false,
    dismissAt: mongoDoc.dismissAt || null,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
  };

  return notificationData;
}

async function migrateNotifications() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting notifications migration...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Load ID mappings
    await loadIdMappings();
    
    // Create tables if they don't exist
    console.log('📋 Creating notifications table...');
    await Notification.sync({ force: false });
    console.log('✅ Notifications table ready');
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('✅ MongoDB connection successful');
    
    // Get total count
    const totalCount = await db.collection('notifications').countDocuments();
    console.log(`📊 Found ${totalCount} notifications to migrate`);
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
      
      // Show sample transformation
      const sampleDocs = await db.collection('notifications').find({}).limit(3).toArray();
      for (const doc of sampleDocs) {
        const transformed = transformNotificationData(doc);
        console.log('\n📄 Sample transformation:');
        console.log(`MongoDB Notification: ${doc.title} (${doc.type})`);
        console.log(`PostgreSQL Notification: ${transformed.title}`);
        console.log(`User mapping: ${doc.userId} -> ${transformed.userId}`);
        console.log(`Related entity: ${doc.relatedEntityType} -> ${transformed.relatedEntityId}`);
      }
      
      return;
    }
    
    // Check for existing data
    const existingCount = await Notification.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing notifications. Skipping duplicates by mongoId.`);
    }
    
    // Process notifications in batches
    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const cursor = db.collection('notifications').find({});
    const notifications = await cursor.toArray();
    
    for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
      const batch = notifications.slice(i, i + BATCH_SIZE);
      
      for (const mongoDoc of batch) {
        try {
          processedCount++;
          
          // Skip if already exists
          const existing = await Notification.findOne({ where: { mongoId: mongoDoc._id?.toString() } });
          if (existing) {
            console.log(`⏭️  Skipping existing notification: ${mongoDoc.title}`);
            skippedCount++;
            continue;
          }
          
          const transformedData = transformNotificationData(mongoDoc);
          
          // Skip if no valid user mapping found
          if (!transformedData.userId) {
            console.log(`⏭️  Skipping notification with no user mapping: ${mongoDoc.title}`);
            skippedCount++;
            continue;
          }
          
          // Create notification
          await Notification.create(transformedData);
          
          migratedCount++;
          
          if (migratedCount % 10 === 0 || migratedCount === totalCount) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} notifications`);
          }
          
        } catch (error) {
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            title: mongoDoc.title,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating notification ${mongoDoc.title}:`, error.message);
          
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
        console.log(`${index + 1}. ${error.title} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.title} (${error.mongoId}): ${error.error}`);
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
    console.log('  node scripts/migrate-notifications.js migrate [--dry-run]');
    console.log('  node scripts/migrate-notifications.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateNotifications();
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

export default { Notification };