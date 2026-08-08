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

// Define Session model (inline for migration)
const Session = sequelize.define('Session', {
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
  sessionId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    field: 'session_id',
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'user_id',
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'expires_at',
  },
  data: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'sessions',
  underscored: true,
  timestamps: true,
});

// Transform MongoDB session to PostgreSQL structure
function transformSessionData(mongoDoc) {
  const sessionData = {
    id: uuidv4(),
    mongoId: mongoDoc._id?.toString(),
    sessionId: mongoDoc.sessionId,
    userId: convertUserObjectIdToUUID(mongoDoc.userId?.toString()),
    expiresAt: mongoDoc.expiresAt,
    data: mongoDoc.data || {},
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
  };

  return sessionData;
}

async function migrateSessions() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting sessions migration...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Load user ID mappings
    await loadUserIdMappings();
    
    // Create tables if they don't exist
    console.log('📋 Creating sessions table...');
    await Session.sync({ force: false });
    console.log('✅ Sessions table ready');
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('✅ MongoDB connection successful');
    
    // Get total count
    const totalCount = await db.collection('sessions').countDocuments();
    console.log(`📊 Found ${totalCount} sessions to migrate`);
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
      
      // Show sample transformation
      const sampleDocs = await db.collection('sessions').find({}).limit(3).toArray();
      for (const doc of sampleDocs) {
        const transformed = transformSessionData(doc);
        console.log('\n📄 Sample transformation:');
        console.log(`MongoDB Session: ${doc.sessionId} (expires: ${doc.expiresAt})`);
        console.log(`PostgreSQL Session: ${transformed.sessionId}`);
        console.log(`User mapping: ${doc.userId} -> ${transformed.userId}`);
      }
      
      return;
    }
    
    // Check for existing data
    const existingCount = await Session.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing sessions. Skipping duplicates by mongoId.`);
    }
    
    // Process sessions in batches
    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const cursor = db.collection('sessions').find({});
    const sessions = await cursor.toArray();
    
    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);
      
      for (const mongoDoc of batch) {
        try {
          processedCount++;
          
          // Skip if already exists
          const existing = await Session.findOne({ where: { mongoId: mongoDoc._id?.toString() } });
          if (existing) {
            console.log(`⏭️  Skipping existing session: ${mongoDoc.sessionId}`);
            skippedCount++;
            continue;
          }
          
          const transformedData = transformSessionData(mongoDoc);
          
          // Skip if no valid user mapping found
          if (!transformedData.userId) {
            console.log(`⏭️  Skipping session with no user mapping: ${mongoDoc.sessionId}`);
            skippedCount++;
            continue;
          }
          
          // Create session
          await Session.create(transformedData);
          
          migratedCount++;
          
          if (migratedCount % 10 === 0 || migratedCount === totalCount) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} sessions`);
          }
          
        } catch (error) {
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            sessionId: mongoDoc.sessionId,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating session ${mongoDoc.sessionId}:`, error.message);
          
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
        console.log(`${index + 1}. ${error.sessionId} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.sessionId} (${error.mongoId}): ${error.error}`);
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
    console.log('  node scripts/migrate-sessions.js migrate [--dry-run]');
    console.log('  node scripts/migrate-sessions.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateSessions();
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

export default { Session };