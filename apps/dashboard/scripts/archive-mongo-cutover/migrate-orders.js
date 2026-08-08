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
  define: {
    // Disable foreign key constraints for migration
    freezeTableName: true,
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Import the models using their class definitions (without the instance-specific connection)
import { 
  Order as OrderClass, OrderCustomer as OrderCustomerClass, OrderAddress as OrderAddressClass, 
  OrderPayment as OrderPaymentClass, OrderItem as OrderItemClass, OrderTimeline as OrderTimelineClass, 
  OrderStore as OrderStoreClass 
} from '../src/models/sequelize/index.js';

// Define models with our migration connection (this is the proven working pattern)
const Order = sequelize.define('Order', OrderClass.getTableName ? OrderClass.rawAttributes : {
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
  orderNumber: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
    field: 'order_number',
  },
  customerId: {
    type: DataTypes.UUID,
    field: 'customer_id',
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  tax: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  shippingFee: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'shipping_fee',
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  couponDiscount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'coupon_discount',
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'total_amount',
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 'confirmed', 'processing', 'shipped', 
      'delivered', 'cancelled', 'refunded', 'failed', 'processed'
    ),
    defaultValue: 'pending',
  },
  orderSource: {
    type: DataTypes.ENUM('web', 'mobile', 'pos', 'phone', 'email'),
    defaultValue: 'web',
    field: 'order_source',
  },
  customerNotes: {
    type: DataTypes.TEXT,
    field: 'customer_notes',
  },
  adminNotes: {
    type: DataTypes.TEXT,
    field: 'admin_notes',
  },
  couponCode: {
    type: DataTypes.STRING(50),
    field: 'coupon_code',
  },
}, {
  tableName: 'orders',
  underscored: true,
  timestamps: true,
});

const OrderCustomer = sequelize.define('OrderCustomer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'order_id',
  },
  firstName: {
    type: DataTypes.STRING(100),
    field: 'first_name',
  },
  lastName: {
    type: DataTypes.STRING(100),
    field: 'last_name',
  },
  email: {
    type: DataTypes.STRING(255),
  },
  phone: {
    type: DataTypes.STRING(20),
  },
}, {
  tableName: 'order_customers',
  underscored: true,
  timestamps: true,
});

const OrderAddress = sequelize.define('OrderAddress', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'order_id',
  },
  addressType: {
    type: DataTypes.ENUM('shipping', 'billing'),
    allowNull: false,
    field: 'address_type',
  },
  firstName: {
    type: DataTypes.STRING(100),
    field: 'first_name',
  },
  lastName: {
    type: DataTypes.STRING(100),
    field: 'last_name',
  },
  phone: {
    type: DataTypes.STRING(20),
  },
  street: {
    type: DataTypes.STRING(200),
  },
  city: {
    type: DataTypes.STRING(100),
  },
  state: {
    type: DataTypes.STRING(100),
  },
  country: {
    type: DataTypes.STRING(100),
  },
  postalCode: {
    type: DataTypes.STRING(20),
    field: 'postal_code',
  },
  landmark: {
    type: DataTypes.STRING(200),
  },
}, {
  tableName: 'order_addresses',
  underscored: true,
  timestamps: true,
});

const OrderPayment = sequelize.define('OrderPayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'order_id',
  },
  method: {
    type: DataTypes.ENUM('card', 'bank_transfer', 'cash_to_vendor', 'wallet', 'paystack', 'flutterwave'),
    allowNull: false,
  },
  provider: {
    type: DataTypes.ENUM('paystack', 'flutterwave', 'stripe', 'manual'),
    defaultValue: 'manual',
  },
  transactionId: {
    type: DataTypes.STRING(255),
    field: 'transaction_id',
  },
  reference: {
    type: DataTypes.STRING(255),
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded', 'partially_refunded'),
    defaultValue: 'pending',
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
  },
  paidAt: {
    type: DataTypes.DATE,
    field: 'paid_at',
  },
  refundedAt: {
    type: DataTypes.DATE,
    field: 'refunded_at',
  },
  refundAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'refund_amount',
  },
}, {
  tableName: 'order_payments',
  underscored: true,
  timestamps: true,
});

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING,
    field: 'mongo_id',
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'order_id',
  },
  productId: {
    type: DataTypes.UUID,
    field: 'product_id',
  },
  storeId: {
    type: DataTypes.UUID,
    field: 'store_id',
  },
  sellerId: {
    type: DataTypes.UUID,
    field: 'seller_id',
  },
  productName: {
    type: DataTypes.STRING(255),
    field: 'product_name',
  },
  productSku: {
    type: DataTypes.STRING(100),
    field: 'product_sku',
  },
  productImage: {
    type: DataTypes.TEXT,
    field: 'product_image',
  },
  productCategory: {
    type: DataTypes.STRING(100),
    field: 'product_category',
  },
  variantColor: {
    type: DataTypes.STRING(50),
    field: 'variant_color',
  },
  variantSize: {
    type: DataTypes.STRING(50),
    field: 'variant_size',
  },
  variantSku: {
    type: DataTypes.STRING(100),
    field: 'variant_sku',
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'unit_price',
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  itemStatus: {
    type: DataTypes.ENUM(
      'pending', 'confirmed', 'processing', 'shipped', 
      'delivered', 'cancelled', 'refunded'
    ),
    defaultValue: 'pending',
    field: 'item_status',
  },
  batchId: {
    type: DataTypes.UUID,
    field: 'batch_id',
  },
  batchCode: {
    type: DataTypes.STRING(100),
    field: 'batch_code',
  },
}, {
  tableName: 'order_items',
  underscored: true,
  timestamps: true,
});

const OrderTimeline = sequelize.define('OrderTimeline', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'order_id',
  },
  orderItemId: {
    type: DataTypes.UUID,
    field: 'order_item_id',
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  note: {
    type: DataTypes.TEXT,
  },
  updatedBy: {
    type: DataTypes.ENUM('system', 'customer', 'admin', 'seller'),
    defaultValue: 'system',
    field: 'updated_by',
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'order_timeline',
  underscored: true,
  timestamps: true,
});

const OrderStore = sequelize.define('OrderStore', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'order_item_id',
  },
  storeId: {
    type: DataTypes.UUID,
    field: 'store_id',
  },
  storeName: {
    type: DataTypes.STRING(255),
    field: 'store_name',
  },
  storeSlug: {
    type: DataTypes.STRING(255),
    field: 'store_slug',
  },
  storePhone: {
    type: DataTypes.STRING(20),
    field: 'store_phone',
  },
  storeEmail: {
    type: DataTypes.STRING(255),
    field: 'store_email',
  },
  website: {
    type: DataTypes.STRING(255),
  },
  instagram: {
    type: DataTypes.STRING(255),
  },
  facebook: {
    type: DataTypes.STRING(255),
  },
  whatsapp: {
    type: DataTypes.STRING(255),
  },
  logo: {
    type: DataTypes.TEXT,
  },
  primaryColor: {
    type: DataTypes.STRING(7),
    field: 'primary_color',
  },
}, {
  tableName: 'order_stores',
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
const customerIdMap = new Map();
const storeIdMap = new Map();
const batchCodeMap = new Map();

function generateUUID() {
  return uuidv4();
}

function convertObjectIdToUUID(objectIdStr, mapName = 'user') {
  if (!objectIdStr) return null;
  
  const maps = {
    user: userIdMap,
    inventory: inventoryIdMap,
    customer: customerIdMap,
    store: storeIdMap,
    batch: batchCodeMap // For batch codes by code, not ObjectId
  };
  
  const map = maps[mapName];
  return map?.get(objectIdStr) || null;
}

/**
 * Load all ID mappings from existing migrated data
 */
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
    
    // Load batch code mappings
    const batches = await sequelize.query(
      'SELECT batch_code, id FROM "inventory_batches" WHERE batch_code IS NOT NULL',
      { type: sequelize.QueryTypes.SELECT }
    );
    batches.forEach(batch => batchCodeMap.set(batch.batch_code, batch.id));
    console.log(`📥 Loaded ${batchCodeMap.size} batch code mappings`);
    
    // TODO: Add customer and store mappings when those are migrated
    console.log(`📥 Total mappings loaded: ${userIdMap.size + inventoryIdMap.size + batchCodeMap.size}`);
    
  } catch (error) {
    console.error('❌ Error loading ID mappings:', error);
    throw error;
  }
}

/**
 * Transform MongoDB order document to normalized PostgreSQL structure
 */
function transformOrderData(mongoDoc) {
  const orderId = generateUUID();
  
  const orderData = {
    id: orderId,
    mongoId: mongoDoc._id?.toString(),
    orderNumber: mongoDoc.orderNumber,
    customerId: convertObjectIdToUUID(mongoDoc.customer?.toString(), 'customer'),
    subtotal: mongoDoc.subtotal || 0,
    tax: mongoDoc.tax || 0,
    shippingFee: mongoDoc.shippingFee || 0,
    discount: mongoDoc.discount || 0,
    couponDiscount: mongoDoc.couponDiscount || 0,
    totalAmount: mongoDoc.totalAmount || 0,
    status: mongoDoc.status || 'pending',
    orderSource: mongoDoc.orderSource || 'web',
    customerNotes: mongoDoc.customerNotes || '',
    adminNotes: mongoDoc.adminNotes || '',
    couponCode: mongoDoc.couponCode || null,
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
  };

  // Customer snapshot
  const customerData = mongoDoc.customerSnapshot ? {
    orderId,
    firstName: mongoDoc.customerSnapshot.firstName,
    lastName: mongoDoc.customerSnapshot.lastName,
    email: mongoDoc.customerSnapshot.email,
    phone: mongoDoc.customerSnapshot.phone,
  } : null;

  // Shipping address
  const shippingAddress = mongoDoc.shippingAddress ? {
    orderId,
    addressType: 'shipping',
    firstName: mongoDoc.shippingAddress.firstName,
    lastName: mongoDoc.shippingAddress.lastName,
    phone: mongoDoc.shippingAddress.phone,
    street: mongoDoc.shippingAddress.street,
    city: mongoDoc.shippingAddress.city,
    state: mongoDoc.shippingAddress.state,
    country: mongoDoc.shippingAddress.country,
    postalCode: mongoDoc.shippingAddress.postalCode,
    landmark: mongoDoc.shippingAddress.landmark,
  } : null;

  // Billing address (if different)
  const billingAddress = mongoDoc.billingAddress ? {
    orderId,
    addressType: 'billing',
    firstName: mongoDoc.billingAddress.firstName,
    lastName: mongoDoc.billingAddress.lastName,
    phone: mongoDoc.billingAddress.phone,
    street: mongoDoc.billingAddress.street,
    city: mongoDoc.billingAddress.city,
    state: mongoDoc.billingAddress.state,
    country: mongoDoc.billingAddress.country,
    postalCode: mongoDoc.billingAddress.postalCode,
  } : null;

  // Payment info
  const paymentData = mongoDoc.paymentInfo ? {
    orderId,
    method: mongoDoc.paymentInfo.method,
    provider: mongoDoc.paymentInfo.provider || 'manual',
    transactionId: mongoDoc.paymentInfo.transactionId,
    reference: mongoDoc.paymentInfo.reference,
    status: mongoDoc.paymentInfo.status || 'pending',
    amount: mongoDoc.totalAmount,
    paidAt: mongoDoc.paymentInfo.paidAt,
    refundedAt: mongoDoc.paymentInfo.refundedAt,
    refundAmount: mongoDoc.paymentInfo.refundAmount || 0,
  } : null;

  // Order items
  const orderItems = [];
  const orderStores = [];
  const timeline = [];

  if (mongoDoc.items && Array.isArray(mongoDoc.items)) {
    mongoDoc.items.forEach((item, index) => {
      const orderItemId = generateUUID();
      
      const orderItem = {
        id: orderItemId,
        mongoId: item._id?.toString(),
        orderId,
        productId: convertObjectIdToUUID(item.product?.toString(), 'inventory'),
        storeId: convertObjectIdToUUID(item.store?.toString(), 'store'),
        sellerId: convertObjectIdToUUID(item.seller?.toString(), 'user'),
        productName: item.productSnapshot?.productName,
        productSku: item.productSnapshot?.sku,
        productImage: item.productSnapshot?.image,
        productCategory: item.productSnapshot?.category,
        variantColor: item.variant?.color,
        variantSize: item.variant?.size,
        variantSku: item.variant?.sku,
        quantity: item.quantity || 1,
        unitPrice: item.price || 0,
        subtotal: item.subtotal || 0,
        itemStatus: item.itemStatus || 'pending',
        batchId: item.batchCode ? batchCodeMap.get(item.batchCode) : null,
        batchCode: item.batchCode,
      };

      orderItems.push(orderItem);

      // Store snapshot for this item
      if (item.storeSnapshot) {
        orderStores.push({
          orderItemId,
          storeId: convertObjectIdToUUID(item.store?.toString(), 'store'),
          storeName: item.storeSnapshot.storeName,
          storeSlug: item.storeSnapshot.storeSlug,
          storePhone: item.storeSnapshot.storePhone,
          storeEmail: item.storeSnapshot.storeEmail,
          website: item.storeSnapshot.onlineStoreInfo?.website,
          instagram: item.storeSnapshot.onlineStoreInfo?.socialMedia?.instagram,
          facebook: item.storeSnapshot.onlineStoreInfo?.socialMedia?.facebook,
          whatsapp: item.storeSnapshot.onlineStoreInfo?.socialMedia?.whatsapp,
          logo: item.storeSnapshot.branding?.logo,
          primaryColor: item.storeSnapshot.branding?.primaryColor,
        });
      }
    });
  }

  // Timeline events
  if (mongoDoc.timeline && Array.isArray(mongoDoc.timeline)) {
    mongoDoc.timeline.forEach(event => {
      timeline.push({
        orderId,
        status: event.status,
        note: event.note || '',
        updatedBy: event.updatedBy || 'system',
        timestamp: event.timestamp || new Date(),
      });
    });
  }

  return {
    order: orderData,
    customer: customerData,
    shippingAddress,
    billingAddress,
    payment: paymentData,
    items: orderItems,
    stores: orderStores,
    timeline,
  };
}

/**
 * Migrate orders from MongoDB to normalized PostgreSQL structure
 */
async function migrateOrders() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting comprehensive orders migration...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Create all tables
    console.log('📋 Creating normalized order tables...');
    await Order.sync();
    await OrderCustomer.sync();
    await OrderAddress.sync(); 
    await OrderPayment.sync();
    await OrderItem.sync();
    await OrderTimeline.sync();
    await OrderStore.sync();
    console.log('✅ All order tables ready');
    
    // Load ID mappings
    await loadIdMappings();
    
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    
    const mongoDb = mongoClient.db();
    const orderCollection = mongoDb.collection('orders');
    
    // Get total count
    const totalCount = await orderCollection.countDocuments();
    console.log(`📊 Total orders to migrate: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log('✅ No orders to migrate');
      return;
    }
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
    }
    
    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Process in batches
    const cursor = orderCollection.find({});
    
    while (await cursor.hasNext()) {
      const batch = [];
      
      // Collect batch
      for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
        batch.push(await cursor.next());
      }
      
      if (batch.length === 0) break;
      
      console.log(`🔄 Processing batch of ${batch.length} orders...`);
      
      // Process batch
      for (const mongoDoc of batch) {
        try {
          const transformedData = transformOrderData(mongoDoc);
          
          if (!isDryRun) {
            // Check for existing record
            const existing = await Order.findOne({
              where: { mongoId: transformedData.order.mongoId }
            });
            
            if (existing) {
              console.log(`⚠️  Skipping existing order: ${transformedData.order.orderNumber}`);
              continue;
            }
            
            // Start transaction for data integrity
            await sequelize.transaction(async (t) => {
              // Create main order
              const order = await Order.create(transformedData.order, { transaction: t });
              
              // Create customer snapshot
              if (transformedData.customer) {
                await OrderCustomer.create(transformedData.customer, { transaction: t });
              }
              
              // Create addresses
              if (transformedData.shippingAddress) {
                await OrderAddress.create(transformedData.shippingAddress, { transaction: t });
              }
              if (transformedData.billingAddress) {
                await OrderAddress.create(transformedData.billingAddress, { transaction: t });
              }
              
              // Create payment info
              if (transformedData.payment) {
                await OrderPayment.create(transformedData.payment, { transaction: t });
              }
              
              // Create order items and store snapshots
              for (let i = 0; i < transformedData.items.length; i++) {
                const orderItem = await OrderItem.create(transformedData.items[i], { transaction: t });
                
                if (transformedData.stores[i]) {
                  await OrderStore.create(transformedData.stores[i], { transaction: t });
                }
              }
              
              // Create timeline events
              for (const timelineEvent of transformedData.timeline) {
                await OrderTimeline.create(timelineEvent, { transaction: t });
              }
            });
          }
          
          migratedCount++;
          
          if (migratedCount % 10 === 0) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} orders`);
          }
          
        } catch (error) {
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            orderNumber: mongoDoc.orderNumber,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating order ${mongoDoc.orderNumber}:`, error.message);
          
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
        console.log(`${index + 1}. ${error.orderNumber} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.orderNumber} (${error.mongoId}): ${error.error}`);
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
    console.log('  node scripts/migrate-orders.js migrate [--dry-run]');
    console.log('  node scripts/migrate-orders.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateOrders();
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