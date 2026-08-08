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

// Define Wishlist model
const Wishlist = sequelize.define('Wishlist', {
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
  },
  customerSnapshot: {
    type: DataTypes.JSONB,
    field: 'customer_snapshot',
    defaultValue: {},
  },
  name: {
    type: DataTypes.STRING(100),
    defaultValue: 'My Wishlist',
  },
  description: {
    type: DataTypes.STRING(500),
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_public',
  },
  shareCode: {
    type: DataTypes.STRING(20),
    unique: true,
    field: 'share_code',
  },
  totalItems: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_items',
  },
  totalValue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_value',
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'view_count',
  },
  lastUpdated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'last_updated',
  },
}, {
  tableName: 'wishlists',
  underscored: true,
  timestamps: true,
});

// Define WishlistItem model
const WishlistItem = sequelize.define('WishlistItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING,
    field: 'mongo_id',
  },
  wishlistId: {
    type: DataTypes.UUID,
    field: 'wishlist_id',
    allowNull: false,
  },
  productId: {
    type: DataTypes.UUID,
    field: 'product_id',
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
  storeId: {
    type: DataTypes.UUID,
    field: 'store_id',
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
  storeOwnerId: {
    type: DataTypes.UUID,
    field: 'store_owner_id',
  },
  storeOwnerMongoId: {
    type: DataTypes.STRING,
    field: 'store_owner_mongo_id',
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium',
  },
  notes: {
    type: DataTypes.STRING(500),
  },
  priceDropAlert: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'price_drop_alert',
  },
  backInStockAlert: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'back_in_stock_alert',
  },
  targetPrice: {
    type: DataTypes.DECIMAL(12, 2),
    field: 'target_price',
  },
  addedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'added_at',
  },
}, {
  tableName: 'wishlist_items',
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

// Helper function to find user ID by mongo ID
async function findUserIdByMongoId(mongoId) {
  if (!mongoId) return null;
  
  try {
    const result = await sequelize.query(
      'SELECT id FROM users WHERE mongo_id = :mongoId',
      {
        replacements: { mongoId: mongoId.toString() },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error finding user:', error.message);
    return null;
  }
}

async function migrateWishlist(mongoWishlist, transaction) {
  try {
    // Find customer ID
    const customerId = await findCustomerIdByMongoId(mongoWishlist.customer);
    
    if (!customerId) {
      console.log(`⚠️  Skipping wishlist ${mongoWishlist._id} - customer not found`);
      return { success: false, reason: 'customer_not_found' };
    }

    // Check if wishlist already exists
    const existingWishlist = await Wishlist.findOne({
      where: { mongoId: mongoWishlist._id.toString() },
      transaction
    });

    if (existingWishlist) {
      console.log(`ℹ️  Wishlist ${mongoWishlist._id} already exists, skipping`);
      return { success: false, reason: 'already_exists' };
    }

    // Prepare wishlist data
    const wishlistData = {
      id: uuidv4(),
      mongoId: mongoWishlist._id.toString(),
      customerId: customerId,
      customerSnapshot: mongoWishlist.customerSnapshot || {},
      name: mongoWishlist.name || 'My Wishlist',
      description: mongoWishlist.description || null,
      isPublic: mongoWishlist.isPublic || false,
      shareCode: mongoWishlist.shareCode || null,
      totalItems: mongoWishlist.stats?.totalItems || 0,
      totalValue: parseFloat(mongoWishlist.stats?.totalValue || 0),
      viewCount: mongoWishlist.stats?.viewCount || 0,
      lastUpdated: mongoWishlist.stats?.lastUpdated || mongoWishlist.updatedAt || new Date(),
      createdAt: mongoWishlist.createdAt || new Date(),
      updatedAt: mongoWishlist.updatedAt || new Date(),
    };

    // Create wishlist
    const wishlist = await Wishlist.create(wishlistData, { transaction });

    // Migrate wishlist items
    let itemsCreated = 0;
    let itemsSkipped = 0;

    if (mongoWishlist.items && Array.isArray(mongoWishlist.items) && mongoWishlist.items.length > 0) {
      for (const item of mongoWishlist.items) {
        try {
          // Find related IDs
          const productId = await findInventoryIdByMongoId(item.product);
          const storeId = await findStoreIdByMongoId(item.store);
          const storeOwnerId = await findUserIdByMongoId(item.storeOwner);

          if (!productId) {
            console.log(`   ⚠️  Skipping wishlist item - product not found`);
            itemsSkipped++;
            continue;
          }

          const wishlistItemData = {
            id: uuidv4(),
            mongoId: item._id?.toString() || null,
            wishlistId: wishlist.id,
            productId: productId,
            productMongoId: item.product?.toString() || null,
            productSnapshot: item.productSnapshot || {},
            storeId: storeId,
            storeMongoId: item.store?.toString() || null,
            storeSnapshot: item.storeSnapshot || {},
            storeOwnerId: storeOwnerId,
            storeOwnerMongoId: item.storeOwner?.toString() || null,
            priority: item.priority || 'medium',
            notes: item.notes || null,
            priceDropAlert: item.notifications?.priceDropAlert !== false,
            backInStockAlert: item.notifications?.backInStockAlert !== false,
            targetPrice: item.notifications?.targetPrice ? parseFloat(item.notifications.targetPrice) : null,
            addedAt: item.addedAt || new Date(),
            createdAt: item.createdAt || new Date(),
            updatedAt: item.updatedAt || new Date(),
          };

          await WishlistItem.create(wishlistItemData, { transaction });
          itemsCreated++;
        } catch (itemError) {
          console.error(`   ❌ Error migrating wishlist item:`, itemError.message);
          itemsSkipped++;
        }
      }
    }

    console.log(`✅ Migrated wishlist ${mongoWishlist._id} (${itemsCreated} items, ${itemsSkipped} skipped)`);
    return { success: true, itemsCreated, itemsSkipped };

  } catch (error) {
    console.error(`❌ Error migrating wishlist ${mongoWishlist._id}:`, error.message);
    throw error;
  }
}

async function runMigration() {
  let mongoClient;

  try {
    console.log('🚀 Starting wishlist migration...\n');

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
    const wishlistsCollection = db.collection('wishlists');

    // Get total count
    const totalWishlists = await wishlistsCollection.countDocuments();
    console.log(`📊 Found ${totalWishlists} wishlists in MongoDB\n`);

    if (totalWishlists === 0) {
      console.log('ℹ️  No wishlists to migrate');
      return;
    }

    // Migrate in batches
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalItemsCreated = 0;
    let totalItemsSkipped = 0;

    const cursor = wishlistsCollection.find({});
    let batch = [];

    for await (const mongoWishlist of cursor) {
      batch.push(mongoWishlist);

      if (batch.length >= BATCH_SIZE) {
        // Process batch
        for (const wishlist of batch) {
          if (isDryRun) {
            console.log(`[DRY RUN] Would migrate wishlist ${wishlist._id}`);
            migratedCount++;
          } else {
            try {
              await sequelize.transaction(async (transaction) => {
                const result = await migrateWishlist(wishlist, transaction);
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

        console.log(`\n📈 Progress: ${migratedCount + skippedCount + errorCount}/${totalWishlists}`);
        batch = [];
      }
    }

    // Process remaining items
    if (batch.length > 0) {
      for (const wishlist of batch) {
        if (isDryRun) {
          console.log(`[DRY RUN] Would migrate wishlist ${wishlist._id}`);
          migratedCount++;
        } else {
          try {
            await sequelize.transaction(async (transaction) => {
              const result = await migrateWishlist(wishlist, transaction);
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
    console.log(`Total wishlists in MongoDB:    ${totalWishlists}`);
    console.log(`Successfully migrated:         ${migratedCount}`);
    console.log(`Skipped:                       ${skippedCount}`);
    console.log(`Errors:                        ${errorCount}`);
    console.log(`Total wishlist items created:  ${totalItemsCreated}`);
    console.log(`Total wishlist items skipped:  ${totalItemsSkipped}`);
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
