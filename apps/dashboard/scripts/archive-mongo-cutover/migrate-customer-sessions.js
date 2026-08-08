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
const BATCH_SIZE = 100;
const MONGODB_URI = process.env.MONGODB_URI;
const isDryRun = process.argv.includes('--dry-run');

// Define CustomerSession model
const CustomerSession = sequelize.define('CustomerSession', {
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
    references: {
      model: 'customers',
      key: 'id',
    },
    onDelete: 'CASCADE',
  },
  sessionId: {
    type: DataTypes.STRING(255),
    field: 'session_id',
    allowNull: false,
    unique: true,
  },
  ipAddress: {
    type: DataTypes.STRING(100),
    field: 'ip_address',
  },
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent',
  },
  device: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Device info: type, browser, os',
  },
  location: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Location info: country, city, region',
  },
  expiresAt: {
    type: DataTypes.DATE,
    field: 'expires_at',
    allowNull: false,
  },
  lastActivityAt: {
    type: DataTypes.DATE,
    field: 'last_activity_at',
    defaultValue: DataTypes.NOW,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'is_active',
    defaultValue: true,
  },
  logoutAt: {
    type: DataTypes.DATE,
    field: 'logout_at',
  },
  pageViews: {
    type: DataTypes.INTEGER,
    field: 'page_views',
    defaultValue: 0,
  },
  activityLog: {
    type: DataTypes.JSONB,
    field: 'activity_log',
    defaultValue: [],
    comment: 'Array of activity objects with action, timestamp, details',
  },
}, {
  tableName: 'customer_sessions',
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

async function migrateCustomerSession(mongoSession, transaction) {
  try {
    // Find customer ID
    const customerId = await findCustomerIdByMongoId(mongoSession.customer);
    
    if (!customerId) {
      console.log(`⚠️  Skipping session ${mongoSession._id} - customer not found`);
      return { success: false, reason: 'customer_not_found' };
    }

    // Check if session already exists
    const existingSession = await CustomerSession.findOne({
      where: { mongoId: mongoSession._id.toString() },
      transaction
    });

    if (existingSession) {
      console.log(`ℹ️  Session ${mongoSession._id} already exists, skipping`);
      return { success: false, reason: 'already_exists' };
    }

    // Prepare device data
    const deviceData = mongoSession.device ? {
      type: mongoSession.device.type || 'unknown',
      browser: mongoSession.device.browser || null,
      os: mongoSession.device.os || null,
    } : {};

    // Prepare location data
    const locationData = mongoSession.location ? {
      country: mongoSession.location.country || null,
      city: mongoSession.location.city || null,
      region: mongoSession.location.region || null,
    } : {};

    // Prepare activity log - map 'type' field to 'action' if it exists
    const activityLog = (mongoSession.activityLog || []).map(activity => ({
      action: activity.action || activity.type || 'page_view',
      timestamp: activity.timestamp || new Date(),
      details: activity.details || activity.metadata || {}
    }));

    // Prepare session data
    const sessionData = {
      id: uuidv4(),
      mongoId: mongoSession._id.toString(),
      customerId: customerId,
      sessionId: mongoSession.sessionId,
      ipAddress: mongoSession.ipAddress || null,
      userAgent: mongoSession.userAgent || null,
      device: deviceData,
      location: locationData,
      expiresAt: mongoSession.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastActivityAt: mongoSession.lastActivityAt || mongoSession.updatedAt || new Date(),
      isActive: mongoSession.isActive !== undefined ? mongoSession.isActive : true,
      logoutAt: mongoSession.logoutAt || null,
      pageViews: parseInt(mongoSession.pageViews || 0),
      activityLog: activityLog,
      createdAt: mongoSession.createdAt || new Date(),
      updatedAt: mongoSession.updatedAt || new Date(),
    };

    // Create session
    await CustomerSession.create(sessionData, { transaction });

    console.log(`✅ Migrated session ${mongoSession._id} (${activityLog.length} activities)`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Error migrating session ${mongoSession._id}:`, error.message);
    throw error;
  }
}

async function runMigration() {
  let mongoClient;

  try {
    console.log('🚀 Starting customer sessions migration...\n');

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
    const sessionsCollection = db.collection('customersessions');

    // Get total count
    const totalSessions = await sessionsCollection.countDocuments();
    console.log(`📊 Found ${totalSessions} customer sessions in MongoDB\n`);

    if (totalSessions === 0) {
      console.log('ℹ️  No customer sessions to migrate');
      return;
    }

    // Migrate in batches
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    const cursor = sessionsCollection.find({});
    let batch = [];

    for await (const mongoSession of cursor) {
      batch.push(mongoSession);

      if (batch.length >= BATCH_SIZE) {
        // Process batch
        for (const session of batch) {
          if (isDryRun) {
            console.log(`[DRY RUN] Would migrate session ${session._id}`);
            migratedCount++;
          } else {
            try {
              await sequelize.transaction(async (transaction) => {
                const result = await migrateCustomerSession(session, transaction);
                if (result.success) {
                  migratedCount++;
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

        console.log(`\n📈 Progress: ${migratedCount + skippedCount + errorCount}/${totalSessions}`);
        batch = [];
      }
    }

    // Process remaining items
    if (batch.length > 0) {
      for (const session of batch) {
        if (isDryRun) {
          console.log(`[DRY RUN] Would migrate session ${session._id}`);
          migratedCount++;
        } else {
          try {
            await sequelize.transaction(async (transaction) => {
              const result = await migrateCustomerSession(session, transaction);
              if (result.success) {
                migratedCount++;
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
    console.log(`Total sessions in MongoDB:  ${totalSessions}`);
    console.log(`Successfully migrated:      ${migratedCount}`);
    console.log(`Skipped:                    ${skippedCount}`);
    console.log(`Errors:                     ${errorCount}`);
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
