#!/usr/bin/env node

/**
 * Complete Data Migration Script - MongoDB to PostgreSQL/Supabase
 * Migrates all data from MongoDB to PostgreSQL using Sequelize models
 * 
 * Usage:
 *   node scripts/migrate-all-data.js --dry-run     # Preview migration
 *   node scripts/migrate-all-data.js --migrate     # Execute migration
 *   node scripts/migrate-all-data.js --validate    # Validate results
 *   node scripts/migrate-all-data.js --model=User  # Migrate specific model
 */

import mongoose from 'mongoose';
import {
  User as PgUser,
  Store as PgStore,
  Customer as PgCustomer,
  CustomerAddress as PgCustomerAddress,
  Inventory as PgInventory,
  InventoryVariant as PgInventoryVariant,
  Order as PgOrder,
  OrderItem as PgOrderItem,
  Sale as PgSale,
  Notification as PgNotification
} from '../src/models/sequelize/index.js';
import sequelize from '../src/lib/sequelize.js';
import connectToDatabase from '../src/lib/mongodb.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

const args = process.argv.slice(2);
const command = args[0];
const modelFilter = args.find(arg => arg.startsWith('--model='))?.split('=')[1];

// Configuration
const BATCH_SIZE = 50; // Smaller batches for complex data
const LOG_FILE = 'full-migration.log';
const ERROR_LOG_FILE = 'full-migration-errors.log';

// Migration models registry
const migrationModels = {
  User: {
    mongoModel: null,
    pgModel: PgUser,
    dependencies: [],
    transform: transformUser
  },
  Store: {
    mongoModel: null,
    pgModel: PgStore,
    dependencies: ['User'],
    transform: transformStore
  },
  Customer: {
    mongoModel: null,
    pgModel: PgCustomer,
    dependencies: [],
    transform: transformCustomer
  },
  Inventory: {
    mongoModel: null,
    pgModel: PgInventory,
    dependencies: ['Store'],
    transform: transformInventory
  },
  Order: {
    mongoModel: null,
    pgModel: PgOrder,
    dependencies: ['Customer'],
    transform: transformOrder
  },
  Sale: {
    mongoModel: null,
    pgModel: PgSale,
    dependencies: ['Order', 'Inventory', 'Store', 'Customer'],
    transform: transformSale
  }
};

// Migration statistics
let migrationStats = {
  startTime: null,
  endTime: null,
  models: {},
  totalErrors: 0
};

// Logging functions
async function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  console.log(logMessage);
  
  try {
    const logFile = isError ? ERROR_LOG_FILE : LOG_FILE;
    await fs.appendFile(logFile, logMessage + '\n');
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

async function logError(error, context = '') {
  const errorMessage = `ERROR ${context}: ${error.message}`;
  await log(errorMessage, true);
  migrationStats.totalErrors++;
}

// Initialize connections and load models
async function initializeConnections() {
  await log('🔌 Initializing connections and loading models...');
  
  try {
    // Connect to MongoDB
    await connectToDatabase();
    await log('✅ Connected to MongoDB');
    
    // Load MongoDB models
    migrationModels.User.mongoModel = (await import('../src/models/User.js')).default;
    migrationModels.Store.mongoModel = (await import('../src/models/Store.js')).default;
    migrationModels.Customer.mongoModel = (await import('../src/models/Customer.js')).default;
    migrationModels.Inventory.mongoModel = (await import('../src/models/Inventory.js')).default;
    migrationModels.Order.mongoModel = (await import('../src/models/Order.js')).default;
    migrationModels.Sale.mongoModel = (await import('../src/models/Sale.js')).default;
    
    await log('✅ MongoDB models loaded');
    
    // Connect to PostgreSQL
    await sequelize.authenticate();
    await log('✅ Connected to PostgreSQL/Supabase');
    
    // Sync all models
    await sequelize.sync();
    await log('✅ PostgreSQL models synchronized');
    
  } catch (error) {
    await logError(error, 'Initialization');
    throw error;
  }
}

// Transform functions for each model
function transformUser(mongoDoc) {
  return {
    id: mongoDoc._id.toString(),
    firstName: mongoDoc.firstName,
    lastName: mongoDoc.lastName,
    email: mongoDoc.email,
    passwordHash: mongoDoc.password,
    role: mongoDoc.role || 'user',
    isActive: mongoDoc.isActive !== false,
    lastLogin: mongoDoc.lastLogin,
    isSubscribed: mongoDoc.isSubscribed || false,
    dateSubscribed: mongoDoc.dateSubscribed,
    currentSubscriptionId: mongoDoc.currentSubscription?.toString(),
    preferences: mongoDoc.preferences || {},
    avatar: mongoDoc.avatar,
    isEmailVerified: mongoDoc.isVerified || false,
    emailVerificationToken: mongoDoc.verificationToken,
    emailVerificationExpiry: mongoDoc.verificationTokenExpiry,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };
}

function transformStore(mongoDoc) {
  return {
    id: mongoDoc._id.toString(),
    ownerId: mongoDoc.userId?.toString() || mongoDoc.owner?.toString(),
    storeName: mongoDoc.storeName,
    storeSlug: mongoDoc.slug,
    storeDescription: mongoDoc.storeDescription,
    storeType: mongoDoc.storeType || 'physical',
    storePhone: mongoDoc.storePhone,
    storeEmail: mongoDoc.storeEmail,
    address: mongoDoc.address || {},
    onlineStoreInfo: mongoDoc.onlineStoreInfo || {},
    branding: mongoDoc.branding || {},
    businessHours: mongoDoc.businessHours || {},
    settings: mongoDoc.settings || {},
    isActive: mongoDoc.isActive !== false,
    isVerified: mongoDoc.isVerified || false,
    verificationStatus: mongoDoc.verificationStatus || 'pending',
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };
}

function transformCustomer(mongoDoc) {
  return {
    id: mongoDoc._id.toString(),
    firstName: mongoDoc.firstName,
    lastName: mongoDoc.lastName,
    email: mongoDoc.email,
    passwordHash: mongoDoc.password,
    phone: mongoDoc.phone,
    dateOfBirth: mongoDoc.dateOfBirth,
    gender: mongoDoc.gender || 'prefer-not-to-say',
    avatar: mongoDoc.avatar,
    isVerified: mongoDoc.isVerified || false,
    isActive: mongoDoc.isActive !== false,
    lastLogin: mongoDoc.lastLogin,
    verificationToken: mongoDoc.verificationToken,
    verificationTokenExpiry: mongoDoc.verificationTokenExpiry,
    preferences: mongoDoc.preferences || {},
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };
}

function transformInventory(mongoDoc) {
  return {
    id: mongoDoc._id.toString(),
    storeId: mongoDoc.store?.toString(),
    productName: mongoDoc.productName,
    sku: mongoDoc.sku,
    category: mongoDoc.category,
    subcategory: mongoDoc.subcategory,
    brand: mongoDoc.brand,
    unitOfMeasure: mongoDoc.unitOfMeasure || 'piece',
    description: mongoDoc.description,
    basePrice: mongoDoc.basePrice || 0,
    costPrice: mongoDoc.costPrice,
    hasVariants: mongoDoc.hasVariants || false,
    quantityInStock: mongoDoc.quantityInStock || 0,
    reorderLevel: mongoDoc.reorderLevel || 5,
    soldQuantity: mongoDoc.soldQuantity || 0,
    images: mongoDoc.images || [],
    primaryImage: mongoDoc.images?.[0],
    details: mongoDoc.details || mongoDoc.clothingDetails || mongoDoc.shoesDetails || {},
    tags: mongoDoc.tags || [],
    isActive: mongoDoc.isActive !== false,
    isPublished: mongoDoc.isPublished !== false,
    lastRestockedAt: mongoDoc.lastRestockedAt,
    lastSoldAt: mongoDoc.lastSoldAt,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };
}

function transformOrder(mongoDoc) {
  return {
    id: mongoDoc._id.toString(),
    orderNumber: mongoDoc.orderNumber,
    customerId: mongoDoc.customer?.toString(),
    customerSnapshot: mongoDoc.customerSnapshot || {},
    subtotal: mongoDoc.subtotal || 0,
    tax: mongoDoc.tax || 0,
    shippingFee: mongoDoc.shippingFee || 0,
    discount: mongoDoc.discount || 0,
    couponDiscount: mongoDoc.couponDiscount || 0,
    totalAmount: mongoDoc.totalAmount || 0,
    status: mongoDoc.status || 'pending',
    shippingAddress: mongoDoc.shippingAddress || {},
    billingAddress: mongoDoc.billingAddress,
    paymentInfo: mongoDoc.paymentInfo || {},
    paymentStatus: mongoDoc.paymentStatus || 'pending',
    deliveryInfo: mongoDoc.deliveryInfo || {},
    estimatedDeliveryDate: mongoDoc.estimatedDeliveryDate,
    actualDeliveryDate: mongoDoc.actualDeliveryDate,
    customerNotes: mongoDoc.customerNotes || mongoDoc.notes,
    source: mongoDoc.source || 'website',
    confirmedAt: mongoDoc.confirmedAt,
    shippedAt: mongoDoc.shippedAt,
    deliveredAt: mongoDoc.deliveredAt,
    cancelledAt: mongoDoc.cancelledAt,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date()
  };
}

function transformSale(mongoDoc) {
  return {
    id: mongoDoc._id.toString(),
    orderId: mongoDoc.orderId?.toString(),
    orderItemId: mongoDoc.orderItemId?.toString(),
    productId: mongoDoc.productId?.toString(),
    variantId: mongoDoc.variantId?.toString(),
    storeId: mongoDoc.storeId?.toString(),
    sellerId: mongoDoc.sellerId?.toString(),
    customerId: mongoDoc.customerId?.toString(),
    quantitySold: mongoDoc.quantitySold || 1,
    unitPrice: mongoDoc.unitPrice || 0,
    totalAmount: mongoDoc.totalAmount || 0,
    costPrice: mongoDoc.costPrice,
    profit: mongoDoc.profit,
    saleDate: mongoDoc.saleDate || mongoDoc.createdAt || new Date(),
    paymentMethod: mongoDoc.paymentMethod,
    paymentReference: mongoDoc.paymentReference,
    channel: mongoDoc.channel || 'online',
    source: mongoDoc.source,
    metadata: mongoDoc.metadata || {},
    createdAt: mongoDoc.createdAt || new Date()
  };
}

// Migrate a single model
async function migrateModel(modelName, dryRun = false) {
  const modelConfig = migrationModels[modelName];
  if (!modelConfig) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  await log(`📦 Starting migration for ${modelName}...`);

  // Initialize stats for this model
  migrationStats.models[modelName] = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0
  };

  try {
    // Get total count
    const total = await modelConfig.mongoModel.countDocuments();
    migrationStats.models[modelName].total = total;
    await log(`📊 Total ${modelName} documents: ${total}`);

    if (total === 0) {
      await log(`ℹ️  No ${modelName} documents to migrate`);
      return;
    }

    // Migrate in batches
    let processed = 0;
    let batchNumber = 1;

    while (processed < total) {
      const documents = await modelConfig.mongoModel
        .find()
        .skip(processed)
        .limit(BATCH_SIZE)
        .lean();

      if (documents.length === 0) break;

      await log(`📦 ${modelName} batch ${batchNumber} (${processed + 1}-${Math.min(processed + BATCH_SIZE, total)})...`);

      const transformedDocs = [];

      for (const doc of documents) {
        try {
          const transformed = modelConfig.transform(doc);
          
          // Check if already exists
          const existing = await modelConfig.pgModel.findByPk(transformed.id);
          if (existing) {
            migrationStats.models[modelName].skipped++;
            continue;
          }

          transformedDocs.push(transformed);
        } catch (error) {
          await logError(error, `${modelName} transformation: ${doc._id}`);
          migrationStats.models[modelName].errors++;
        }
      }

      if (transformedDocs.length > 0 && !dryRun) {
        try {
          await modelConfig.pgModel.bulkCreate(transformedDocs, { 
            validate: true,
            ignoreDuplicates: true 
          });
          migrationStats.models[modelName].migrated += transformedDocs.length;
          await log(`✅ ${modelName} batch ${batchNumber}: Migrated ${transformedDocs.length} documents`);
        } catch (error) {
          await logError(error, `${modelName} bulk insert batch ${batchNumber}`);
          
          // Try individual inserts
          for (const doc of transformedDocs) {
            try {
              await modelConfig.pgModel.create(doc);
              migrationStats.models[modelName].migrated++;
            } catch (individualError) {
              await logError(individualError, `${modelName} individual insert: ${doc.id}`);
              migrationStats.models[modelName].errors++;
            }
          }
        }
      } else if (dryRun) {
        await log(`🔍 DRY RUN - Would migrate ${transformedDocs.length} ${modelName} documents`);
      }

      processed += documents.length;
      batchNumber++;

      // Progress update
      const progress = Math.round((processed / total) * 100);
      await log(`📈 ${modelName} Progress: ${processed}/${total} (${progress}%)`);

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    await log(`✅ ${modelName} migration completed!`);
    
  } catch (error) {
    await logError(error, `${modelName} migration`);
    throw error;
  }
}

// Migrate specific models or handle order items
async function migrateOrderItems(dryRun = false) {
  await log('📦 Starting Order Items migration...');

  try {
    const orders = await migrationModels.Order.mongoModel.find().lean();
    let totalItems = 0;
    let migratedItems = 0;
    let errorItems = 0;

    for (const order of orders) {
      if (!order.items || order.items.length === 0) continue;

      for (const item of order.items) {
        totalItems++;
        
        try {
          const transformedItem = {
            id: item._id?.toString() || `${order._id}-${Math.random().toString(36).substr(2, 9)}`,
            orderId: order._id.toString(),
            productId: item.product?.toString(),
            variantId: item.variant?.variantId?.toString(),
            productSnapshot: item.productSnapshot || {},
            variant: item.variant || {},
            quantity: item.quantity || 1,
            unitPrice: item.price || 0,
            subtotal: item.subtotal || 0,
            storeId: item.store?.toString(),
            storeSnapshot: item.storeSnapshot || {},
            sellerId: item.seller?.toString(),
            status: item.itemStatus || 'pending',
            trackingInfo: item.itemTracking || {},
            batchId: item.batchId?.toString(),
            batchCode: item.batchCode,
            createdAt: order.createdAt || new Date()
          };

          if (!dryRun) {
            const existing = await PgOrderItem.findByPk(transformedItem.id);
            if (!existing) {
              await PgOrderItem.create(transformedItem);
              migratedItems++;
            }
          } else {
            migratedItems++; // Count for dry run
          }
        } catch (error) {
          await logError(error, `Order item migration: ${order._id}`);
          errorItems++;
        }
      }
    }

    await log(`📊 Order Items Summary: Total: ${totalItems}, Migrated: ${migratedItems}, Errors: ${errorItems}`);
    
  } catch (error) {
    await logError(error, 'Order Items migration');
    throw error;
  }
}

// Main migration function
async function migrateAll(dryRun = false) {
  migrationStats.startTime = new Date();
  await log(`🚀 Starting full migration${dryRun ? ' (DRY RUN)' : ''}...`);

  // Define migration order (respecting dependencies)
  const migrationOrder = ['User', 'Store', 'Customer', 'Inventory', 'Order', 'Sale'];

  try {
    for (const modelName of migrationOrder) {
      if (modelFilter && modelFilter !== modelName) {
        continue;
      }
      await migrateModel(modelName, dryRun);
    }

    // Migrate order items separately since they're embedded
    if (!modelFilter || modelFilter === 'OrderItem') {
      await migrateOrderItems(dryRun);
    }

  } catch (error) {
    await logError(error, 'Full migration');
    throw error;
  } finally {
    migrationStats.endTime = new Date();
    const duration = (migrationStats.endTime - migrationStats.startTime) / 1000;
    
    await log('📊 Migration Summary:');
    Object.entries(migrationStats.models).forEach(async ([model, stats]) => {
      await log(`   ${model}: ${stats.migrated}/${stats.total} migrated, ${stats.skipped} skipped, ${stats.errors} errors`);
    });
    await log(`   Total errors: ${migrationStats.totalErrors}`);
    await log(`   Duration: ${duration.toFixed(2)} seconds`);
  }
}

// Validation function
async function validateMigration() {
  await log('🔍 Validating complete migration...');

  const validationResults = {};

  for (const [modelName, config] of Object.entries(migrationModels)) {
    try {
      const mongoCount = await config.mongoModel.countDocuments();
      const pgCount = await config.pgModel.count();
      
      validationResults[modelName] = {
        mongo: mongoCount,
        postgresql: pgCount,
        match: mongoCount === pgCount
      };

      await log(`📊 ${modelName}: MongoDB=${mongoCount}, PostgreSQL=${pgCount} ${mongoCount === pgCount ? '✅' : '⚠️'}`);
    } catch (error) {
      await logError(error, `Validation ${modelName}`);
      validationResults[modelName] = { error: error.message };
    }
  }

  return validationResults;
}

// Show help
function showHelp() {
  console.log(`
IVMA App Complete Data Migration Script

Usage: node scripts/migrate-all-data.js [command] [options]

Commands:
  --dry-run              Preview complete migration without executing
  --migrate              Execute complete data migration
  --validate             Validate migration results
  --model=ModelName      Migrate only specific model (User, Store, Customer, etc.)
  --help                 Show this help message

Examples:
  node scripts/migrate-all-data.js --dry-run
  node scripts/migrate-all-data.js --migrate
  node scripts/migrate-all-data.js --model=User --migrate
  node scripts/migrate-all-data.js --validate

Migration Order:
  1. User
  2. Store
  3. Customer  
  4. Inventory
  5. Order + OrderItems
  6. Sale

Logs:
  Migration logs: ${LOG_FILE}
  Error logs: ${ERROR_LOG_FILE}
`);
}

// Main function
async function main() {
  console.log('🏪 IVMA App Complete Data Migration Tool\n');

  try {
    const isDryRun = args.includes('--dry-run');
    const isMigrate = args.includes('--migrate');
    const isValidate = args.includes('--validate');

    if (!isDryRun && !isMigrate && !isValidate && command !== '--help') {
      showHelp();
      return;
    }

    await initializeConnections();

    if (isDryRun || isMigrate) {
      await migrateAll(isDryRun);
    }

    if (isValidate) {
      await validateMigration();
    }

    if (command === '--help') {
      showHelp();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    // Close connections
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
        await log('👋 MongoDB connection closed');
      }
      if (sequelize) {
        await sequelize.close();
        await log('👋 PostgreSQL connection closed');
      }
    } catch (error) {
      console.error('Error closing connections:', error.message);
    }
  }
}

// Handle signals
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted by user');
  process.exit(1);
});

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});