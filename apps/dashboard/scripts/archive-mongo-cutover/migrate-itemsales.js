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
const inventoryBatchIdMap = new Map();
const saleIdMap = new Map();

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
    
    // Load inventory batch ID mappings
    const batches = await sequelize.query(
      'SELECT mongo_id, id FROM "inventory_batches" WHERE mongo_id IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    batches.forEach(batch => inventoryBatchIdMap.set(batch.mongo_id, batch.id));
    console.log(`📥 Loaded ${inventoryBatchIdMap.size} inventory batch ID mappings`);
    
    // Load sale ID mappings
    const sales = await sequelize.query(
      'SELECT mongo_id, id FROM "sales" WHERE mongo_id IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    sales.forEach(sale => saleIdMap.set(sale.mongo_id, sale.id));
    console.log(`📥 Loaded ${saleIdMap.size} sale ID mappings`);
    
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
    batch: inventoryBatchIdMap,
    sale: saleIdMap,
  };
  
  const map = maps[mapName];
  return map?.get(objectIdStr) || null;
}

// Define ItemSale model (main table)
const ItemSale = sequelize.define('ItemSale', {
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
  inventoryId: {
    type: DataTypes.UUID,
    field: 'inventory_id',
  },
  saleId: {
    type: DataTypes.UUID,
    field: 'sale_id',
  },
  saleTransactionId: {
    type: DataTypes.STRING,
    field: 'sale_transaction_id',
  },
  // Item snapshot (product info at time of sale)
  productName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'product_name',
  },
  sku: {
    type: DataTypes.STRING(100),
  },
  category: {
    type: DataTypes.STRING(100),
  },
  brand: {
    type: DataTypes.STRING(100),
  },
  unitOfMeasure: {
    type: DataTypes.STRING(50),
    field: 'unit_of_measure',
  },
  // Quantity and pricing
  quantitySold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    field: 'quantity_sold',
  },
  unitSalePrice: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'unit_sale_price',
    defaultValue: 0,
  },
  totalSaleAmount: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'total_sale_amount',
    defaultValue: 0,
  },
  unitCostPrice: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'unit_cost_price',
    defaultValue: 0,
  },
  totalCostAmount: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'total_cost_amount',
    defaultValue: 0,
  },
  // Batch cost breakdown (aggregated)
  totalBatchCost: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'total_batch_cost',
    defaultValue: 0,
  },
  weightedAverageCost: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'weighted_average_cost',
    defaultValue: 0,
  },
  batchCount: {
    type: DataTypes.INTEGER,
    field: 'batch_count',
    defaultValue: 0,
  },
  // Payment and transaction details
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'transfer', 'card', 'credit', 'pos', 'other'),
    field: 'payment_method',
    defaultValue: 'cash',
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
  // Sale details
  saleDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'sale_date',
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'refunded', 'partially_refunded'),
    defaultValue: 'pending',
  },
  soldBy: {
    type: DataTypes.UUID,
    field: 'sold_by',
  },
  saleLocation: {
    type: DataTypes.STRING(255),
    field: 'sale_location',
  },
  notes: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'item_sales',
  underscored: true,
  timestamps: true,
});

// Define ItemSaleBatch model (detailed batch tracking)
const ItemSaleBatch = sequelize.define('ItemSaleBatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  itemSaleId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'item_sale_id',
  },
  batchId: {
    type: DataTypes.UUID,
    field: 'batch_id',
  },
  batchCode: {
    type: DataTypes.STRING(100),
    field: 'batch_code',
  },
  quantitySoldFromBatch: {
    type: DataTypes.INTEGER,
    field: 'quantity_sold_from_batch',
    defaultValue: 1,
  },
  unitCostPriceFromBatch: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'unit_cost_price_from_batch',
    defaultValue: 0,
  },
  batchDateReceived: {
    type: DataTypes.DATE,
    field: 'batch_date_received',
  },
  batchSupplier: {
    type: DataTypes.STRING(255),
    field: 'batch_supplier',
  },
  mongoBatchId: {
    type: DataTypes.STRING,
    field: 'mongo_batch_id',
  },
}, {
  tableName: 'item_sale_batches',
  underscored: true,
  timestamps: true,
});

// Define ItemSaleRefund model (refund tracking)
const ItemSaleRefund = sequelize.define('ItemSaleRefund', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  itemSaleId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'item_sale_id',
  },
  isRefunded: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_refunded',
  },
  refundDate: {
    type: DataTypes.DATE,
    field: 'refund_date',
  },
  refundAmount: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'refund_amount',
    defaultValue: 0,
  },
  refundQuantity: {
    type: DataTypes.INTEGER,
    field: 'refund_quantity',
    defaultValue: 0,
  },
  refundReason: {
    type: DataTypes.TEXT,
    field: 'refund_reason',
  },
  refundedBy: {
    type: DataTypes.UUID,
    field: 'refunded_by',
  },
  notes: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'item_sale_refunds',
  underscored: true,
  timestamps: true,
});

// Define relationships
ItemSale.hasMany(ItemSaleBatch, { 
  foreignKey: 'itemSaleId',
  as: 'batches'
});
ItemSaleBatch.belongsTo(ItemSale, { 
  foreignKey: 'itemSaleId',
  as: 'itemSale'
});

ItemSale.hasOne(ItemSaleRefund, { 
  foreignKey: 'itemSaleId',
  as: 'refundInfo'
});
ItemSaleRefund.belongsTo(ItemSale, { 
  foreignKey: 'itemSaleId',
  as: 'itemSale'
});

// Transform MongoDB item sale to PostgreSQL structure
function transformItemSaleData(mongoDoc) {
  // Map payment method, ensuring we have a valid enum value
  const paymentMethod = mongoDoc.paymentMethod || 'cash';
  console.log(`🔍 Processing payment method: "${paymentMethod}"`);
  
  const validPaymentMethods = ['cash', 'transfer', 'card', 'credit', 'pos', 'other'];
  const finalPaymentMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : 'other';
  
  if (finalPaymentMethod !== paymentMethod) {
    console.log(`⚠️  Mapped "${paymentMethod}" to "${finalPaymentMethod}"`);
  }

  const itemSaleData = {
    id: uuidv4(),
    mongoId: mongoDoc._id?.toString(),
    userId: convertObjectIdToUUID(mongoDoc.userId?.toString(), 'user'),
    inventoryId: convertObjectIdToUUID(mongoDoc.inventoryId?.toString(), 'inventory'),
    saleId: convertObjectIdToUUID(mongoDoc.saleTransactionId?.toString(), 'sale'),
    saleTransactionId: mongoDoc.saleTransactionId?.toString() || '',
    
    // Item snapshot
    productName: mongoDoc.itemSnapshot?.productName || '',
    sku: mongoDoc.itemSnapshot?.sku || '',
    category: mongoDoc.itemSnapshot?.category || '',
    brand: mongoDoc.itemSnapshot?.brand || '',
    unitOfMeasure: mongoDoc.itemSnapshot?.unitOfMeasure || '',
    
    // Quantity and pricing
    quantitySold: mongoDoc.quantitySold || 1,
    unitSalePrice: mongoDoc.unitSalePrice || 0,
    totalSaleAmount: mongoDoc.totalSaleAmount || 0,
    unitCostPrice: mongoDoc.unitCostPrice || 0,
    totalCostAmount: mongoDoc.totalCostAmount || 0,
    
    // Batch cost breakdown
    totalBatchCost: mongoDoc.batchCostBreakdown?.totalBatchCost || 0,
    weightedAverageCost: mongoDoc.batchCostBreakdown?.weightedAverageCost || 0,
    batchCount: mongoDoc.batchCostBreakdown?.batchCount || 0,
    
    // Payment and transaction details
    paymentMethod: finalPaymentMethod,
    
    // Customer info
    customerName: mongoDoc.customer?.name || '',
    customerPhone: mongoDoc.customer?.phone || '',
    customerEmail: mongoDoc.customer?.email || '',
    
    // Sale details
    saleDate: mongoDoc.saleDate || mongoDoc.createdAt || new Date(),
    status: mongoDoc.status || 'pending',
    soldBy: convertObjectIdToUUID(mongoDoc.soldBy?.toString(), 'user'),
    saleLocation: mongoDoc.saleLocation || '',
    notes: mongoDoc.notes || '',
    
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
  };

  return itemSaleData;
}

function transformItemSaleBatches(mongoDoc, itemSaleId) {
  if (!mongoDoc.batchesSoldFrom || !Array.isArray(mongoDoc.batchesSoldFrom)) {
    return [];
  }

  return mongoDoc.batchesSoldFrom.map(batch => ({
    id: uuidv4(),
    itemSaleId: itemSaleId,
    batchId: convertObjectIdToUUID(batch.batchId?.toString(), 'batch'),
    batchCode: batch.batchCode || '',
    quantitySoldFromBatch: batch.quantitySoldFromBatch || 1,
    unitCostPriceFromBatch: batch.unitCostPriceFromBatch || 0,
    batchDateReceived: batch.batchDateReceived || null,
    batchSupplier: batch.batchSupplier || '',
    mongoBatchId: batch._id?.toString() || null,
  }));
}

function transformItemSaleRefund(mongoDoc, itemSaleId) {
  if (!mongoDoc.refundInfo) {
    return null;
  }

  return {
    id: uuidv4(),
    itemSaleId: itemSaleId,
    isRefunded: mongoDoc.refundInfo.isRefunded || false,
    refundDate: mongoDoc.refundInfo.refundDate || null,
    refundAmount: mongoDoc.refundInfo.refundAmount || 0,
    refundQuantity: mongoDoc.refundInfo.refundQuantity || 0,
    refundReason: mongoDoc.refundInfo.refundReason || '',
    refundedBy: null, // Not available in source data
    notes: '',
  };
}

async function migrateItemSales() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting item sales migration...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Load ID mappings
    await loadIdMappings();
    
    // Create tables if they don't exist
    console.log('📋 Creating item sales tables...');
    
    // Drop existing tables if they exist (due to enum change)
    try {
      await sequelize.query('DROP TABLE IF EXISTS "item_sale_refunds" CASCADE;');
      await sequelize.query('DROP TABLE IF EXISTS "item_sale_batches" CASCADE;'); 
      await sequelize.query('DROP TABLE IF EXISTS "item_sales" CASCADE;');
      
      // Drop the enum types
      await sequelize.query('DROP TYPE IF EXISTS "enum_item_sales_payment_method" CASCADE;');
      await sequelize.query('DROP TYPE IF EXISTS "enum_item_sales_status" CASCADE;');
      await sequelize.query('DROP TYPE IF EXISTS "enum_item_sales_sale_type" CASCADE;');
      
      console.log('✅ Dropped existing ItemSale tables and enums');
    } catch (error) {
      console.log('ℹ️  Tables/enums did not exist, proceeding...');
    }
    
    await ItemSale.sync({ force: true });
    await ItemSaleBatch.sync({ force: true });
    await ItemSaleRefund.sync({ force: true });
    console.log('✅ Item sales tables ready');
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('✅ MongoDB connection successful');
    
    // Get total count
    const totalCount = await db.collection('itemsales').countDocuments();
    console.log(`📊 Found ${totalCount} item sales to migrate`);
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
      
      // Show sample transformation
      const sampleDocs = await db.collection('itemsales').find({}).limit(2).toArray();
      for (const doc of sampleDocs) {
        const transformed = transformItemSaleData(doc);
        const batches = transformItemSaleBatches(doc, transformed.id);
        const refund = transformItemSaleRefund(doc, transformed.id);
        
        console.log('\n📄 Sample transformation:');
        console.log(`MongoDB ItemSale: ${doc.itemSnapshot?.productName} (${doc.status})`);
        console.log(`PostgreSQL ItemSale: ${transformed.productName}`);
        console.log(`User mapping: ${doc.userId} -> ${transformed.userId}`);
        console.log(`Inventory mapping: ${doc.inventoryId} -> ${transformed.inventoryId}`);
        console.log(`Sale mapping: ${doc.saleTransactionId} -> ${transformed.saleId}`);
        console.log(`Batches to create: ${batches.length}`);
        console.log(`Refund record: ${refund ? 'Yes' : 'No'}`);
        console.log(`Sale amount: ${transformed.totalSaleAmount}`);
        console.log(`Cost amount: ${transformed.totalCostAmount}`);
      }
      
      return;
    }
    
    // Check for existing data
    const existingCount = await ItemSale.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing item sales. Skipping duplicates by mongoId.`);
    }
    
    // Process item sales in batches
    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const cursor = db.collection('itemsales').find({});
    const itemSales = await cursor.toArray();
    
    for (let i = 0; i < itemSales.length; i += BATCH_SIZE) {
      const batch = itemSales.slice(i, i + BATCH_SIZE);
      
      for (const mongoDoc of batch) {
        const transaction = await sequelize.transaction();
        
        try {
          processedCount++;
          
          // Skip if already exists
          const existing = await ItemSale.findOne({ 
            where: { mongoId: mongoDoc._id?.toString() },
            transaction
          });
          if (existing) {
            console.log(`⏭️  Skipping existing item sale: ${mongoDoc.itemSnapshot?.productName}`);
            skippedCount++;
            await transaction.rollback();
            continue;
          }
          
          const transformedData = transformItemSaleData(mongoDoc);
          
          // Skip if no valid user mapping found
          if (!transformedData.userId) {
            console.log(`⏭️  Skipping item sale with no user mapping: ${mongoDoc.itemSnapshot?.productName}`);
            skippedCount++;
            await transaction.rollback();
            continue;
          }
          
          // Create item sale
          const createdItemSale = await ItemSale.create(transformedData, { transaction });
          
          // Create batches
          const batches = transformItemSaleBatches(mongoDoc, createdItemSale.id);
          if (batches.length > 0) {
            await ItemSaleBatch.bulkCreate(batches, { transaction });
          }
          
          // Create refund record
          const refund = transformItemSaleRefund(mongoDoc, createdItemSale.id);
          if (refund) {
            await ItemSaleRefund.create(refund, { transaction });
          }
          
          await transaction.commit();
          migratedCount++;
          
          if (migratedCount % 10 === 0 || migratedCount === totalCount) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} item sales (${batches.length} batches)`);
          }
          
        } catch (error) {
          await transaction.rollback();
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            productName: mongoDoc.itemSnapshot?.productName,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating item sale ${mongoDoc.itemSnapshot?.productName}:`, error.message);
          
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
    console.log(`✅ Successfully migrated: ${migratedCount} item sales`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${processedCount}/${totalCount}`);
    
    // Get total counts for related data
    const totalBatches = await ItemSaleBatch.count();
    const totalRefunds = await ItemSaleRefund.count();
    console.log(`📦 Total batch records created: ${totalBatches}`);
    console.log(`💰 Total refund records created: ${totalRefunds}`);
    
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
    console.log('  node scripts/migrate-itemsales.js migrate [--dry-run]');
    console.log('  node scripts/migrate-itemsales.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateItemSales();
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
  ItemSale, 
  ItemSaleBatch, 
  ItemSaleRefund 
};