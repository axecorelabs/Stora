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

// Define Cart model
const Cart = sequelize.define('Cart', {
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
  customerId: {
    type: DataTypes.UUID,
    field: 'customer_id',
    allowNull: false,
    unique: true,
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  tax: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  shipping: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
  },
  couponCode: {
    type: DataTypes.STRING(100),
    field: 'coupon_code',
  },
  couponDiscount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'coupon_discount',
  },
  itemCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'item_count',
  },
  lastUpdated: {
    type: DataTypes.DATE,
    field: 'last_updated',
  },
  expiresAt: {
    type: DataTypes.DATE,
    field: 'expires_at',
  },
  status: {
    type: DataTypes.ENUM('active', 'abandoned', 'converted', 'expired'),
    defaultValue: 'active',
  },
  sessionId: {
    type: DataTypes.STRING(255),
    field: 'session_id',
  },
}, {
  tableName: 'carts',
  underscored: true,
  timestamps: true,
});

// Define CartItem model
const CartItem = sequelize.define('CartItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING,
    field: 'mongo_id',
  },
  cartId: {
    type: DataTypes.UUID,
    field: 'cart_id',
    allowNull: false,
    references: {
      model: 'carts',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  productId: {
    type: DataTypes.UUID,
    field: 'product_id',
    references: {
      model: 'inventory',
      key: 'id',
    },
  },
  productMongoId: {
    type: DataTypes.STRING,
    field: 'product_mongo_id',
  },
  productSnapshot: {
    type: DataTypes.JSONB,
    field: 'product_snapshot',
    defaultValue: {},
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  storeId: {
    type: DataTypes.UUID,
    field: 'store_id',
    references: {
      model: 'stores',
      key: 'id',
    },
  },
  storeMongoId: {
    type: DataTypes.STRING,
    field: 'store_mongo_id',
  },
  storeSnapshot: {
    type: DataTypes.JSONB,
    field: 'store_snapshot',
    defaultValue: {},
  },
  addedAt: {
    type: DataTypes.DATE,
    field: 'added_at',
    defaultValue: DataTypes.NOW,
  },
  notes: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'cart_items',
  underscored: true,
  timestamps: true,
});

// Helper function to find customer ID by mongo ID
async function findCustomerIdByMongoId(mongoId) {
  if (!mongoId) return null;
  
  try {
    const result = await sequelize.query(
      'SELECT id FROM customers WHERE mongo_id = :mongoId',
      {
        replacements: { mongoId: mongoId.toString() },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error finding customer:', error.message);
    return null;
  }
}

// Helper function to find inventory ID by mongo ID
async function findInventoryIdByMongoId(mongoId) {
  if (!mongoId) return null;
  
  try {
    const result = await sequelize.query(
      'SELECT id FROM inventory WHERE mongo_id = :mongoId',
      {
        replacements: { mongoId: mongoId.toString() },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error finding inventory:', error.message);
    return null;
  }
}

// Helper function to find store ID by mongo ID
async function findStoreIdByMongoId(mongoId) {
  if (!mongoId) return null;
  
  try {
    const result = await sequelize.query(
      'SELECT id FROM stores WHERE mongo_id = :mongoId',
      {
        replacements: { mongoId: mongoId.toString() },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error finding store:', error.message);
    return null;
  }
}

async function migrateCart(mongoCart, transaction) {
  try {
    // Find customer ID
    const customerId = await findCustomerIdByMongoId(mongoCart.customer);
    
    if (!customerId) {
      console.log(`⚠️  Skipping cart ${mongoCart._id} - customer not found`);
      return { success: false, reason: 'customer_not_found' };
    }

    // Check if cart already exists
    const existingCart = await Cart.findOne({
      where: { mongoId: mongoCart._id.toString() },
      transaction
    });

    if (existingCart) {
      console.log(`ℹ️  Cart ${mongoCart._id} already exists, skipping`);
      return { success: false, reason: 'already_exists' };
    }

    // Prepare cart data
    const cartData = {
      id: uuidv4(),
      mongoId: mongoCart._id.toString(),
      customerId: customerId,
      subtotal: parseFloat(mongoCart.subtotal || 0),
      tax: parseFloat(mongoCart.tax || 0),
      discount: parseFloat(mongoCart.discount || 0),
      shipping: parseFloat(mongoCart.shipping || 0),
      total: parseFloat(mongoCart.total || 0),
      couponCode: mongoCart.couponCode || null,
      couponDiscount: parseFloat(mongoCart.couponDiscount || 0),
      itemCount: parseInt(mongoCart.itemCount || 0),
      lastUpdated: mongoCart.lastUpdated || mongoCart.updatedAt || new Date(),
      expiresAt: mongoCart.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: mongoCart.status || 'active',
      sessionId: mongoCart.sessionId || null,
      createdAt: mongoCart.createdAt || new Date(),
      updatedAt: mongoCart.updatedAt || new Date(),
    };

    // Create cart
    const cart = await Cart.create(cartData, { transaction });

    // Migrate cart items
    let itemsCreated = 0;
    let itemsSkipped = 0;

    if (mongoCart.items && Array.isArray(mongoCart.items) && mongoCart.items.length > 0) {
      for (const item of mongoCart.items) {
        try {
          // Find product and store IDs
          const productId = await findInventoryIdByMongoId(item.product);
          const storeId = await findStoreIdByMongoId(item.store);

          if (!productId) {
            console.log(`   ⚠️  Skipping cart item - product not found`);
            itemsSkipped++;
            continue;
          }

          const cartItemData = {
            id: uuidv4(),
            mongoId: item._id?.toString() || null,
            cartId: cart.id,
            productId: productId,
            productMongoId: item.product?.toString() || null,
            productSnapshot: item.productSnapshot || {},
            quantity: parseInt(item.quantity || 1),
            price: parseFloat(item.price || 0),
            subtotal: parseFloat(item.subtotal || 0),
            storeId: storeId,
            storeMongoId: item.store?.toString() || null,
            storeSnapshot: item.storeSnapshot || {},
            addedAt: item.addedAt || new Date(),
            notes: item.notes || null,
            createdAt: item.createdAt || new Date(),
            updatedAt: item.updatedAt || new Date(),
          };

          await CartItem.create(cartItemData, { transaction });
          itemsCreated++;
        } catch (itemError) {
          console.error(`   ❌ Error migrating cart item:`, itemError.message);
          itemsSkipped++;
        }
      }
    }

    console.log(`✅ Migrated cart ${mongoCart._id} (${itemsCreated} items, ${itemsSkipped} skipped)`);
    return { success: true, itemsCreated, itemsSkipped };

  } catch (error) {
    console.error(`❌ Error migrating cart ${mongoCart._id}:`, error.message);
    throw error;
  }
}

async function runMigration() {
  let mongoClient;

  try {
    console.log('🚀 Starting cart migration...\n');

    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written\n');
    }

    // Test PostgreSQL connection
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection established\n');

    // Sync models (create tables if they don't exist)
    if (!isDryRun) {
      await sequelize.sync({ alter: false });
      console.log('✅ Database tables synced\n');
    }

    // Connect to MongoDB
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ MongoDB connection established\n');

    const db = mongoClient.db();
    const cartsCollection = db.collection('carts');

    // Get total count
    const totalCarts = await cartsCollection.countDocuments();
    console.log(`📊 Found ${totalCarts} carts in MongoDB\n`);

    if (totalCarts === 0) {
      console.log('ℹ️  No carts to migrate');
      return;
    }

    // Migrate in batches
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalItemsCreated = 0;
    let totalItemsSkipped = 0;

    const cursor = cartsCollection.find({});
    let batch = [];

    for await (const mongoCart of cursor) {
      batch.push(mongoCart);

      if (batch.length >= BATCH_SIZE) {
        // Process batch
        for (const cart of batch) {
          if (isDryRun) {
            console.log(`[DRY RUN] Would migrate cart ${cart._id}`);
            migratedCount++;
          } else {
            try {
              await sequelize.transaction(async (transaction) => {
                const result = await migrateCart(cart, transaction);
                if (result.success) {
                  migratedCount++;
                  totalItemsCreated += result.itemsCreated || 0;
                  totalItemsSkipped += result.itemsSkipped || 0;
                } else {
                  skippedCount++;
                }
              });
            } catch (error) {
              errorCount++;
              console.error(`Error in transaction:`, error.message);
            }
          }
        }

        console.log(`\n📈 Progress: ${migratedCount + skippedCount + errorCount}/${totalCarts}`);
        batch = [];
      }
    }

    // Process remaining items
    if (batch.length > 0) {
      for (const cart of batch) {
        if (isDryRun) {
          console.log(`[DRY RUN] Would migrate cart ${cart._id}`);
          migratedCount++;
        } else {
          try {
            await sequelize.transaction(async (transaction) => {
              const result = await migrateCart(cart, transaction);
              if (result.success) {
                migratedCount++;
                totalItemsCreated += result.itemsCreated || 0;
                totalItemsSkipped += result.itemsSkipped || 0;
              } else {
                skippedCount++;
              }
            });
          } catch (error) {
            errorCount++;
            console.error(`Error in transaction:`, error.message);
          }
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total carts in MongoDB:    ${totalCarts}`);
    console.log(`Successfully migrated:     ${migratedCount}`);
    console.log(`Skipped:                   ${skippedCount}`);
    console.log(`Errors:                    ${errorCount}`);
    console.log(`Total cart items created:  ${totalItemsCreated}`);
    console.log(`Total cart items skipped:  ${totalItemsSkipped}`);
    console.log('='.repeat(50));

    if (isDryRun) {
      console.log('\n✅ Dry run completed - no data was written');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log('\n🔌 MongoDB connection closed');
    }
    await sequelize.close();
    console.log('🔌 PostgreSQL connection closed\n');
  }
}

// Run migration
runMigration();
