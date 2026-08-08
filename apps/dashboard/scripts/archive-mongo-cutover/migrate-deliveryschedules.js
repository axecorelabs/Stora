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
const orderIdMap = new Map();

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
    
    // Load order ID mappings
    const orders = await sequelize.query(
      'SELECT mongo_id, id FROM "orders" WHERE mongo_id IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    orders.forEach(order => orderIdMap.set(order.mongo_id, order.id));
    console.log(`📥 Loaded ${orderIdMap.size} order ID mappings`);
    
  } catch (error) {
    console.error('❌ Error loading ID mappings:', error);
    throw error;
  }
}

function convertObjectIdToUUID(objectIdStr, mapName = 'user') {
  if (!objectIdStr) return null;
  
  const maps = {
    user: userIdMap,
    order: orderIdMap,
  };
  
  const map = maps[mapName];
  return map?.get(objectIdStr) || null;
}

// Define DeliverySchedule model (main table)
const DeliverySchedule = sequelize.define('DeliverySchedule', {
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
  orderId: {
    type: DataTypes.UUID,
    field: 'order_id',
  },
  saleId: {
    type: DataTypes.STRING,
    field: 'sale_id',
  },
  transactionId: {
    type: DataTypes.STRING,
    field: 'transaction_id',
  },
  deliveryType: {
    type: DataTypes.ENUM('order', 'sale', 'custom'),
    field: 'delivery_type',
    defaultValue: 'order',
  },
  // Customer info
  customerName: {
    type: DataTypes.STRING(255),
    field: 'customer_name',
  },
  customerPhone: {
    type: DataTypes.STRING(50),
    field: 'customer_phone',
  },
  customerEmail: {
    type: DataTypes.STRING(255),
    field: 'customer_email',
  },
  // Delivery address
  addressStreet: {
    type: DataTypes.STRING(255),
    field: 'address_street',
  },
  addressCity: {
    type: DataTypes.STRING(100),
    field: 'address_city',
  },
  addressState: {
    type: DataTypes.STRING(100),
    field: 'address_state',
  },
  addressPostalCode: {
    type: DataTypes.STRING(20),
    field: 'address_postal_code',
  },
  addressCountry: {
    type: DataTypes.STRING(100),
    field: 'address_country',
  },
  fullAddress: {
    type: DataTypes.TEXT,
    field: 'full_address',
  },
  // Delivery details
  scheduledDate: {
    type: DataTypes.DATE,
    field: 'scheduled_date',
  },
  timeSlot: {
    type: DataTypes.STRING(50),
    field: 'time_slot',
  },
  estimatedDuration: {
    type: DataTypes.INTEGER,
    field: 'estimated_duration', // in minutes
  },
  deliveryFee: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'delivery_fee',
    defaultValue: 0,
  },
  deliveryMethod: {
    type: DataTypes.ENUM('self_delivery', 'third_party', 'pickup', 'courier'),
    field: 'delivery_method',
    defaultValue: 'self_delivery',
  },
  deliveryNotes: {
    type: DataTypes.TEXT,
    field: 'delivery_notes',
  },
  // Status and assignment
  status: {
    type: DataTypes.ENUM('scheduled', 'in_progress', 'delivered', 'cancelled', 'failed'),
    defaultValue: 'scheduled',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium',
  },
  assignedTo: {
    type: DataTypes.UUID,
    field: 'assigned_to',
  },
  assignedDate: {
    type: DataTypes.DATE,
    field: 'assigned_date',
  },
  deliveredAt: {
    type: DataTypes.DATE,
    field: 'delivered_at',
  },
  deliveredBy: {
    type: DataTypes.UUID,
    field: 'delivered_by',
  },
  // Delivery confirmation
  confirmationRecipientName: {
    type: DataTypes.STRING(255),
    field: 'confirmation_recipient_name',
  },
  confirmationSignature: {
    type: DataTypes.TEXT,
    field: 'confirmation_signature',
  },
  confirmationPhoto: {
    type: DataTypes.TEXT,
    field: 'confirmation_photo',
  },
  confirmationNotes: {
    type: DataTypes.TEXT,
    field: 'confirmation_notes',
  },
  // Financial
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'total_amount',
    defaultValue: 0,
  },
  amountCollected: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'amount_collected',
    defaultValue: 0,
  },
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'paid', 'partially_paid', 'failed'),
    field: 'payment_status',
    defaultValue: 'pending',
  },
}, {
  tableName: 'delivery_schedules',
  underscored: true,
  timestamps: true,
});

// Define DeliveryScheduleItem model (normalized items table)
const DeliveryScheduleItem = sequelize.define('DeliveryScheduleItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  deliveryScheduleId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'delivery_schedule_id',
  },
  productName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'product_name',
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'unit_price',
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  mongoItemId: {
    type: DataTypes.STRING,
    field: 'mongo_item_id',
  },
}, {
  tableName: 'delivery_schedule_items',
  underscored: true,
  timestamps: true,
});

// Define DeliveryStatusHistory model (normalized status history table)
const DeliveryStatusHistory = sequelize.define('DeliveryStatusHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  deliveryScheduleId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'delivery_schedule_id',
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'in_progress', 'delivered', 'cancelled', 'failed'),
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updatedBy: {
    type: DataTypes.UUID,
    field: 'updated_by',
  },
  notes: {
    type: DataTypes.TEXT,
  },
  mongoHistoryId: {
    type: DataTypes.STRING,
    field: 'mongo_history_id',
  },
}, {
  tableName: 'delivery_status_history',
  underscored: true,
  timestamps: true,
});

// Define relationships
DeliverySchedule.hasMany(DeliveryScheduleItem, { 
  foreignKey: 'deliveryScheduleId',
  as: 'items'
});
DeliveryScheduleItem.belongsTo(DeliverySchedule, { 
  foreignKey: 'deliveryScheduleId',
  as: 'deliverySchedule'
});

DeliverySchedule.hasMany(DeliveryStatusHistory, { 
  foreignKey: 'deliveryScheduleId',
  as: 'statusHistory'
});
DeliveryStatusHistory.belongsTo(DeliverySchedule, { 
  foreignKey: 'deliveryScheduleId',
  as: 'deliverySchedule'
});

// Transform MongoDB delivery schedule to PostgreSQL structure
function transformDeliveryScheduleData(mongoDoc) {
  const deliveryData = {
    id: uuidv4(),
    mongoId: mongoDoc._id?.toString(),
    userId: convertObjectIdToUUID(mongoDoc.userId?.toString(), 'user'),
    orderId: convertObjectIdToUUID(mongoDoc.orderId?.toString(), 'order'),
    saleId: mongoDoc.saleId?.toString() || null,
    transactionId: mongoDoc.transactionId || null,
    deliveryType: mongoDoc.deliveryType || 'order',
    
    // Customer info
    customerName: mongoDoc.customer?.name || '',
    customerPhone: mongoDoc.customer?.phone || '',
    customerEmail: mongoDoc.customer?.email || '',
    
    // Delivery address
    addressStreet: mongoDoc.deliveryAddress?.street || '',
    addressCity: mongoDoc.deliveryAddress?.city || '',
    addressState: mongoDoc.deliveryAddress?.state || '',
    addressPostalCode: mongoDoc.deliveryAddress?.postalCode || '',
    addressCountry: mongoDoc.deliveryAddress?.country || '',
    fullAddress: mongoDoc.deliveryAddress?.fullAddress || '',
    
    // Delivery details
    scheduledDate: mongoDoc.scheduledDate || null,
    timeSlot: mongoDoc.timeSlot || 'anytime',
    estimatedDuration: mongoDoc.estimatedDuration || 30,
    deliveryFee: mongoDoc.deliveryFee || 0,
    deliveryMethod: mongoDoc.deliveryMethod || 'self_delivery',
    deliveryNotes: mongoDoc.deliveryNotes || '',
    
    // Status and assignment
    status: mongoDoc.status || 'scheduled',
    priority: mongoDoc.priority || 'medium',
    assignedTo: convertObjectIdToUUID(mongoDoc.assignedTo?.toString(), 'user'),
    assignedDate: mongoDoc.assignedDate || null,
    deliveredAt: mongoDoc.deliveredAt || null,
    deliveredBy: convertObjectIdToUUID(mongoDoc.deliveredBy?.toString(), 'user'),
    
    // Delivery confirmation
    confirmationRecipientName: mongoDoc.deliveryConfirmation?.recipientName || '',
    confirmationSignature: mongoDoc.deliveryConfirmation?.signature || '',
    confirmationPhoto: mongoDoc.deliveryConfirmation?.photo || '',
    confirmationNotes: mongoDoc.deliveryConfirmation?.notes || '',
    
    // Financial
    totalAmount: mongoDoc.totalAmount || 0,
    amountCollected: mongoDoc.amountCollected || 0,
    paymentStatus: mongoDoc.paymentStatus || 'pending',
    
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
  };

  return deliveryData;
}

function transformDeliveryItems(mongoDoc, deliveryScheduleId) {
  if (!mongoDoc.items || !Array.isArray(mongoDoc.items)) {
    return [];
  }

  return mongoDoc.items.map(item => ({
    id: uuidv4(),
    deliveryScheduleId: deliveryScheduleId,
    productName: item.productName || '',
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice || 0,
    total: item.total || 0,
    mongoItemId: item._id?.toString() || null,
  }));
}

function transformStatusHistory(mongoDoc, deliveryScheduleId) {
  if (!mongoDoc.statusHistory || !Array.isArray(mongoDoc.statusHistory)) {
    return [];
  }

  return mongoDoc.statusHistory.map(history => ({
    id: uuidv4(),
    deliveryScheduleId: deliveryScheduleId,
    status: history.status || 'scheduled',
    timestamp: history.timestamp || new Date(),
    updatedBy: convertObjectIdToUUID(history.updatedBy?.toString(), 'user'),
    notes: history.notes || '',
    mongoHistoryId: history._id?.toString() || null,
  }));
}

async function migrateDeliverySchedules() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting delivery schedules migration...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Load ID mappings
    await loadIdMappings();
    
    // Create tables if they don't exist
    console.log('📋 Creating delivery schedule tables...');
    await DeliverySchedule.sync({ force: false });
    await DeliveryScheduleItem.sync({ force: false });
    await DeliveryStatusHistory.sync({ force: false });
    console.log('✅ Delivery schedule tables ready');
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('✅ MongoDB connection successful');
    
    // Get total count
    const totalCount = await db.collection('deliveryschedules').countDocuments();
    console.log(`📊 Found ${totalCount} delivery schedules to migrate`);
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
      
      // Show sample transformation
      const sampleDocs = await db.collection('deliveryschedules').find({}).limit(2).toArray();
      for (const doc of sampleDocs) {
        const transformed = transformDeliveryScheduleData(doc);
        const items = transformDeliveryItems(doc, transformed.id);
        const history = transformStatusHistory(doc, transformed.id);
        
        console.log('\n📄 Sample transformation:');
        console.log(`MongoDB DeliverySchedule: ${doc.transactionId} (${doc.status})`);
        console.log(`PostgreSQL DeliverySchedule: ${transformed.transactionId}`);
        console.log(`User mapping: ${doc.userId} -> ${transformed.userId}`);
        console.log(`Order mapping: ${doc.orderId} -> ${transformed.orderId}`);
        console.log(`Items to create: ${items.length}`);
        console.log(`Status history entries: ${history.length}`);
        console.log(`Address: ${transformed.fullAddress}`);
      }
      
      return;
    }
    
    // Check for existing data
    const existingCount = await DeliverySchedule.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing delivery schedules. Skipping duplicates by mongoId.`);
    }
    
    // Process delivery schedules in batches
    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const cursor = db.collection('deliveryschedules').find({});
    const schedules = await cursor.toArray();
    
    for (let i = 0; i < schedules.length; i += BATCH_SIZE) {
      const batch = schedules.slice(i, i + BATCH_SIZE);
      
      for (const mongoDoc of batch) {
        const transaction = await sequelize.transaction();
        
        try {
          processedCount++;
          
          // Skip if already exists
          const existing = await DeliverySchedule.findOne({ 
            where: { mongoId: mongoDoc._id?.toString() },
            transaction
          });
          if (existing) {
            console.log(`⏭️  Skipping existing delivery schedule: ${mongoDoc.transactionId}`);
            skippedCount++;
            await transaction.rollback();
            continue;
          }
          
          const transformedData = transformDeliveryScheduleData(mongoDoc);
          
          // Skip if no valid user mapping found
          if (!transformedData.userId) {
            console.log(`⏭️  Skipping delivery schedule with no user mapping: ${mongoDoc.transactionId}`);
            skippedCount++;
            await transaction.rollback();
            continue;
          }
          
          // Create delivery schedule
          const createdSchedule = await DeliverySchedule.create(transformedData, { transaction });
          
          // Create items
          const items = transformDeliveryItems(mongoDoc, createdSchedule.id);
          if (items.length > 0) {
            await DeliveryScheduleItem.bulkCreate(items, { transaction });
          }
          
          // Create status history
          const history = transformStatusHistory(mongoDoc, createdSchedule.id);
          if (history.length > 0) {
            await DeliveryStatusHistory.bulkCreate(history, { transaction });
          }
          
          await transaction.commit();
          migratedCount++;
          
          if (migratedCount % 5 === 0 || migratedCount === totalCount) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} delivery schedules (${items.length} items, ${history.length} history entries)`);
          }
          
        } catch (error) {
          await transaction.rollback();
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            transactionId: mongoDoc.transactionId,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating delivery schedule ${mongoDoc.transactionId}:`, error.message);
          
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
    console.log(`✅ Successfully migrated: ${migratedCount} delivery schedules`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${processedCount}/${totalCount}`);
    
    // Get total counts for related data
    const totalItems = await DeliveryScheduleItem.count();
    const totalHistory = await DeliveryStatusHistory.count();
    console.log(`📦 Total delivery items created: ${totalItems}`);
    console.log(`📋 Total status history entries: ${totalHistory}`);
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n❌ Error details:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.transactionId} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.transactionId} (${error.mongoId}): ${error.error}`);
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
    console.log('  node scripts/migrate-deliveryschedules.js migrate [--dry-run]');
    console.log('  node scripts/migrate-deliveryschedules.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateDeliverySchedules();
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

export default { 
  DeliverySchedule, 
  DeliveryScheduleItem, 
  DeliveryStatusHistory 
};