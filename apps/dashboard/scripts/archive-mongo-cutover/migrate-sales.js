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
  };
  
  const map = maps[mapName];
  return map?.get(objectIdStr) || null;
}

// Define Sale model (main table)
const Sale = sequelize.define('Sale', {
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
  transactionId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'transaction_id',
    unique: true,
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
  // Financial totals
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  tax: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  // Payment details
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'transfer', 'card', 'credit', 'other'),
    field: 'payment_method',
    defaultValue: 'cash',
  },
  amountReceived: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'amount_received',
    defaultValue: 0,
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
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
  notes: {
    type: DataTypes.TEXT,
  },
  // Batch summary (aggregated data)
  totalBatchesUsed: {
    type: DataTypes.INTEGER,
    field: 'total_batches_used',
    defaultValue: 0,
  },
  totalCostFromBatches: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'total_cost_from_batches',
    defaultValue: 0,
  },
  totalProfitFromBatches: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'total_profit_from_batches',
    defaultValue: 0,
  },
  averageCostPerUnit: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'average_cost_per_unit',
    defaultValue: 0,
  },
}, {
  tableName: 'sales',
  underscored: true,
  timestamps: true,
});

// Define SaleItem model (normalized items table)
const SaleItem = sequelize.define('SaleItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  saleId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'sale_id',
  },
  inventoryId: {
    type: DataTypes.UUID,
    field: 'inventory_id',
  },
  productName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'product_name',
  },
  sku: {
    type: DataTypes.STRING(100),
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
  // Cost breakdown
  totalCost: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'total_cost',
    defaultValue: 0,
  },
  weightedAverageCost: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'weighted_average_cost',
    defaultValue: 0,
  },
  profit: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  mongoItemId: {
    type: DataTypes.STRING,
    field: 'mongo_item_id',
  },
}, {
  tableName: 'sale_items',
  underscored: true,
  timestamps: true,
});

// Define SaleItemBatch model (batch tracking for each item)
const SaleItemBatch = sequelize.define('SaleItemBatch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  saleItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'sale_item_id',
  },
  batchId: {
    type: DataTypes.UUID,
    field: 'batch_id',
  },
  batchCode: {
    type: DataTypes.STRING(100),
    field: 'batch_code',
  },
  quantityFromBatch: {
    type: DataTypes.INTEGER,
    field: 'quantity_from_batch',
    defaultValue: 1,
  },
  costPriceFromBatch: {
    type: DataTypes.DECIMAL(10, 2),
    field: 'cost_price_from_batch',
    defaultValue: 0,
  },
  mongoBatchId: {
    type: DataTypes.STRING,
    field: 'mongo_batch_id',
  },
}, {
  tableName: 'sale_item_batches',
  underscored: true,
  timestamps: true,
});

// Define relationships
Sale.hasMany(SaleItem, { 
  foreignKey: 'saleId',
  as: 'items'
});
SaleItem.belongsTo(Sale, { 
  foreignKey: 'saleId',
  as: 'sale'
});

SaleItem.hasMany(SaleItemBatch, { 
  foreignKey: 'saleItemId',
  as: 'batches'
});
SaleItemBatch.belongsTo(SaleItem, { 
  foreignKey: 'saleItemId',
  as: 'saleItem'
});

// Transform MongoDB sale to PostgreSQL structure
function transformSaleData(mongoDoc) {
  const saleData = {
    id: uuidv4(),
    mongoId: mongoDoc._id?.toString(),
    userId: convertObjectIdToUUID(mongoDoc.userId?.toString(), 'user'),
    transactionId: mongoDoc.transactionId || '',
    
    // Customer info
    customerName: mongoDoc.customer?.name || '',
    customerPhone: mongoDoc.customer?.phone || '',
    customerEmail: mongoDoc.customer?.email || '',
    
    // Financial totals
    subtotal: mongoDoc.subtotal || 0,
    discount: mongoDoc.discount || 0,
    tax: mongoDoc.tax || 0,
    total: mongoDoc.total || 0,
    
    // Payment details
    paymentMethod: mongoDoc.paymentMethod || 'cash',
    amountReceived: mongoDoc.amountReceived || 0,
    balance: mongoDoc.balance || 0,
    
    // Sale details
    saleDate: mongoDoc.saleDate || mongoDoc.createdAt || new Date(),
    status: mongoDoc.status || 'pending',
    soldBy: convertObjectIdToUUID(mongoDoc.soldBy?.toString(), 'user'),
    notes: mongoDoc.notes || '',
    
    // Batch summary
    totalBatchesUsed: mongoDoc.batchSummary?.totalBatchesUsed || 0,
    totalCostFromBatches: mongoDoc.batchSummary?.totalCostFromBatches || 0,
    totalProfitFromBatches: mongoDoc.batchSummary?.totalProfitFromBatches || 0,
    averageCostPerUnit: mongoDoc.batchSummary?.averageCostPerUnit || 0,
    
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
  };

  return saleData;
}

function transformSaleItems(mongoDoc, saleId) {
  if (!mongoDoc.items || !Array.isArray(mongoDoc.items)) {
    return [];
  }

  return mongoDoc.items.map(item => ({
    id: uuidv4(),
    saleId: saleId,
    inventoryId: convertObjectIdToUUID(item.inventoryId?.toString(), 'inventory'),
    productName: item.productName || '',
    sku: item.sku || '',
    quantity: item.quantity || 1,
    unitPrice: item.unitPrice || 0,
    total: item.total || 0,
    
    // Cost breakdown
    totalCost: item.costBreakdown?.totalCost || 0,
    weightedAverageCost: item.costBreakdown?.weightedAverageCost || 0,
    profit: item.costBreakdown?.profit || 0,
    
    mongoItemId: item._id?.toString() || null,
  }));
}

function transformSaleItemBatches(mongoDoc, saleItemsMap) {
  if (!mongoDoc.items || !Array.isArray(mongoDoc.items)) {
    return [];
  }

  const batches = [];
  
  mongoDoc.items.forEach(item => {
    if (item.batchesSoldFrom && Array.isArray(item.batchesSoldFrom)) {
      const saleItemId = saleItemsMap.get(item._id?.toString());
      
      item.batchesSoldFrom.forEach(batch => {
        batches.push({
          id: uuidv4(),
          saleItemId: saleItemId,
          batchId: convertObjectIdToUUID(batch.batchId?.toString(), 'batch'),
          batchCode: batch.batchCode || '',
          quantityFromBatch: batch.quantityFromBatch || 1,
          costPriceFromBatch: batch.costPriceFromBatch || 0,
          mongoBatchId: batch._id?.toString() || null,
        });
      });
    }
  });

  return batches;
}

async function migrateSales() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting sales migration...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Load ID mappings
    await loadIdMappings();
    
    // Create tables if they don't exist
    console.log('📋 Creating sales tables...');
    await Sale.sync({ force: false });
    await SaleItem.sync({ force: false });
    await SaleItemBatch.sync({ force: false });
    console.log('✅ Sales tables ready');
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('✅ MongoDB connection successful');
    
    // Get total count
    const totalCount = await db.collection('sales').countDocuments();
    console.log(`📊 Found ${totalCount} sales to migrate`);
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
      
      // Show sample transformation
      const sampleDocs = await db.collection('sales').find({}).limit(2).toArray();
      for (const doc of sampleDocs) {
        const transformed = transformSaleData(doc);
        const items = transformSaleItems(doc, transformed.id);
        
        // Create mapping for batches
        const saleItemsMap = new Map();
        if (doc.items) {
          doc.items.forEach((item, index) => {
            saleItemsMap.set(item._id?.toString(), items[index]?.id);
          });
        }
        const batches = transformSaleItemBatches(doc, saleItemsMap);
        
        console.log('\n📄 Sample transformation:');
        console.log(`MongoDB Sale: ${doc.transactionId} (${doc.status})`);
        console.log(`PostgreSQL Sale: ${transformed.transactionId}`);
        console.log(`User mapping: ${doc.userId} -> ${transformed.userId}`);
        console.log(`Items to create: ${items.length}`);
        console.log(`Batches to create: ${batches.length}`);
        console.log(`Total amount: ${transformed.total}`);
        console.log(`Total profit: ${transformed.totalProfitFromBatches}`);
      }
      
      return;
    }
    
    // Check for existing data
    const existingCount = await Sale.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing sales. Skipping duplicates by mongoId.`);
    }
    
    // Process sales in batches
    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const cursor = db.collection('sales').find({});
    const sales = await cursor.toArray();
    
    for (let i = 0; i < sales.length; i += BATCH_SIZE) {
      const batch = sales.slice(i, i + BATCH_SIZE);
      
      for (const mongoDoc of batch) {
        const transaction = await sequelize.transaction();
        
        try {
          processedCount++;
          
          // Skip if already exists
          const existing = await Sale.findOne({ 
            where: { mongoId: mongoDoc._id?.toString() },
            transaction
          });
          if (existing) {
            console.log(`⏭️  Skipping existing sale: ${mongoDoc.transactionId}`);
            skippedCount++;
            await transaction.rollback();
            continue;
          }
          
          const transformedData = transformSaleData(mongoDoc);
          
          // Skip if no valid user mapping found
          if (!transformedData.userId) {
            console.log(`⏭️  Skipping sale with no user mapping: ${mongoDoc.transactionId}`);
            skippedCount++;
            await transaction.rollback();
            continue;
          }
          
          // Create sale
          const createdSale = await Sale.create(transformedData, { transaction });
          
          // Create items
          const items = transformSaleItems(mongoDoc, createdSale.id);
          const createdItems = [];
          if (items.length > 0) {
            const itemsResult = await SaleItem.bulkCreate(items, { 
              transaction,
              returning: true 
            });
            createdItems.push(...itemsResult);
          }
          
          // Create item-batch mappings
          if (createdItems.length > 0) {
            const saleItemsMap = new Map();
            mongoDoc.items?.forEach((mongoItem, index) => {
              if (createdItems[index]) {
                saleItemsMap.set(mongoItem._id?.toString(), createdItems[index].id);
              }
            });
            
            const batches = transformSaleItemBatches(mongoDoc, saleItemsMap);
            if (batches.length > 0) {
              await SaleItemBatch.bulkCreate(batches, { transaction });
            }
          }
          
          await transaction.commit();
          migratedCount++;
          
          if (migratedCount % 10 === 0 || migratedCount === totalCount) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} sales (${items.length} items)`);
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
          
          console.error(`❌ Error migrating sale ${mongoDoc.transactionId}:`, error.message);
          
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
    console.log(`✅ Successfully migrated: ${migratedCount} sales`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${processedCount}/${totalCount}`);
    
    // Get total counts for related data
    const totalItems = await SaleItem.count();
    const totalBatches = await SaleItemBatch.count();
    console.log(`📦 Total sale items created: ${totalItems}`);
    console.log(`🏷️  Total batch records created: ${totalBatches}`);
    
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
    console.log('  node scripts/migrate-sales.js migrate [--dry-run]');
    console.log('  node scripts/migrate-sales.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateSales();
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
  Sale, 
  SaleItem, 
  SaleItemBatch 
};