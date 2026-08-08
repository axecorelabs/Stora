#!/usr/bin/env node

/**
 * User Migration Script - MongoDB to PostgreSQL/Supabase
 * Migrates all existing users from MongoDB to PostgreSQL using Sequelize
 * 
 * Usage:
 *   node scripts/migrate-users.js --dry-run    # Preview migration without executing
 *   node scripts/migrate-users.js --migrate    # Execute the migration
 *   node scripts/migrate-users.js --validate   # Validate migration results
 *   node scripts/migrate-users.js --rollback   # Rollback migration (if needed)
 */

import mongoose from 'mongoose';
import { User as SequelizeUser } from '../src/models/sequelize/index.js';
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

// Import MongoDB User model
let MongoUser;

const args = process.argv.slice(2);
const command = args[0];

// Migration configuration
const BATCH_SIZE = 100;
const LOG_FILE = 'user-migration.log';
const ERROR_LOG_FILE = 'user-migration-errors.log';

// Migration state
let migrationStats = {
  totalUsers: 0,
  migratedUsers: 0,
  skippedUsers: 0,
  errorUsers: 0,
  startTime: null,
  endTime: null,
  errors: []
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
  migrationStats.errors.push({ context, error: error.message, timestamp: new Date() });
  await log(errorMessage, true);
}

// Initialize connections
async function initializeConnections() {
  await log('🔌 Initializing database connections...');
  
  try {
    // Connect to MongoDB
    await connectToDatabase();
    await log('✅ Connected to MongoDB');
    
    // Import MongoDB User model after connection
    const MongoUserModule = await import('../src/models/User.js');
    MongoUser = MongoUserModule.default;
    
    // Connect to PostgreSQL
    await sequelize.authenticate();
    await log('✅ Connected to PostgreSQL/Supabase');
    
    // Ensure User table exists
    await SequelizeUser.sync();
    await log('✅ PostgreSQL User table synchronized');
    
  } catch (error) {
    await logError(error, 'Connection initialization');
    throw error;
  }
}

// Transform MongoDB user to PostgreSQL format
function transformUser(mongoUser) {
  const transformed = {
    id: mongoUser._id.toString(),
    firstName: mongoUser.firstName,
    lastName: mongoUser.lastName,
    email: mongoUser.email,
    passwordHash: mongoUser.password, // MongoDB stores hashed password
    role: mongoUser.role || 'user',
    isActive: mongoUser.isActive !== false,
    lastLogin: mongoUser.lastLogin,
    isSubscribed: mongoUser.isSubscribed || false,
    dateSubscribed: mongoUser.dateSubscribed,
    currentSubscriptionId: mongoUser.currentSubscription?.toString() || null,
    preferences: mongoUser.preferences || {},
    avatar: mongoUser.avatar,
    isEmailVerified: mongoUser.isVerified || false,
    emailVerificationToken: mongoUser.verificationToken,
    emailVerificationExpiry: mongoUser.verificationTokenExpiry,
    createdAt: mongoUser.createdAt || new Date(),
    updatedAt: mongoUser.updatedAt || new Date()
  };

  return transformed;
}

// Validate transformation
function validateTransformation(mongoUser, transformedUser) {
  const errors = [];

  if (!transformedUser.firstName) {
    errors.push('Missing firstName');
  }
  if (!transformedUser.lastName) {
    errors.push('Missing lastName');
  }
  if (!transformedUser.email) {
    errors.push('Missing email');
  }
  if (!transformedUser.passwordHash) {
    errors.push('Missing passwordHash');
  }

  return errors;
}

// Get total count of users to migrate
async function getTotalUserCount() {
  try {
    const count = await MongoUser.countDocuments();
    await log(`📊 Total users in MongoDB: ${count}`);
    return count;
  } catch (error) {
    await logError(error, 'Getting user count');
    throw error;
  }
}

// Check if user already exists in PostgreSQL
async function userExists(email, id) {
  try {
    const existing = await SequelizeUser.findOne({
      where: {
        [sequelize.Op.or]: [
          { email },
          { id }
        ]
      }
    });
    return !!existing;
  } catch (error) {
    await logError(error, `Checking existence for user: ${email}`);
    return false;
  }
}

// Migrate users in batches
async function migrateUsersBatch(skip = 0, batchSize = BATCH_SIZE, dryRun = false) {
  try {
    const mongoUsers = await MongoUser.find()
      .skip(skip)
      .limit(batchSize)
      .lean();

    if (mongoUsers.length === 0) {
      return 0;
    }

    const usersToMigrate = [];
    
    for (const mongoUser of mongoUsers) {
      try {
        // Transform the user
        const transformedUser = transformUser(mongoUser);
        
        // Validate transformation
        const validationErrors = validateTransformation(mongoUser, transformedUser);
        if (validationErrors.length > 0) {
          await logError(
            new Error(`Validation failed: ${validationErrors.join(', ')}`),
            `User ${mongoUser.email || mongoUser._id}`
          );
          migrationStats.errorUsers++;
          continue;
        }

        // Check if user already exists
        if (await userExists(transformedUser.email, transformedUser.id)) {
          await log(`⏭️  Skipping existing user: ${transformedUser.email}`);
          migrationStats.skippedUsers++;
          continue;
        }

        usersToMigrate.push(transformedUser);
      } catch (error) {
        await logError(error, `Processing user ${mongoUser.email || mongoUser._id}`);
        migrationStats.errorUsers++;
      }
    }

    if (usersToMigrate.length === 0) {
      await log(`📦 Batch ${Math.floor(skip / batchSize) + 1}: No users to migrate`);
      return mongoUsers.length;
    }

    if (dryRun) {
      await log(`🔍 DRY RUN - Would migrate ${usersToMigrate.length} users:`);
      usersToMigrate.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} (${user.firstName} ${user.lastName})`);
      });
      return mongoUsers.length;
    }

    // Insert users into PostgreSQL
    try {
      await SequelizeUser.bulkCreate(usersToMigrate, {
        validate: true,
        individualHooks: false // Skip password hashing since already hashed
      });

      migrationStats.migratedUsers += usersToMigrate.length;
      await log(`✅ Batch ${Math.floor(skip / batchSize) + 1}: Migrated ${usersToMigrate.length} users`);
      
    } catch (error) {
      await logError(error, `Bulk insert batch ${Math.floor(skip / batchSize) + 1}`);
      
      // Try individual inserts to identify problematic records
      for (const user of usersToMigrate) {
        try {
          await SequelizeUser.create(user, { validate: true });
          migrationStats.migratedUsers++;
          await log(`✅ Individual insert: ${user.email}`);
        } catch (individualError) {
          await logError(individualError, `Individual insert: ${user.email}`);
          migrationStats.errorUsers++;
        }
      }
    }

    return mongoUsers.length;
  } catch (error) {
    await logError(error, `Batch migration (skip: ${skip})`);
    throw error;
  }
}

// Main migration function
async function migrateUsers(dryRun = false) {
  migrationStats.startTime = new Date();
  await log(`🚀 Starting user migration${dryRun ? ' (DRY RUN)' : ''}...`);

  try {
    // Get total count
    migrationStats.totalUsers = await getTotalUserCount();

    if (migrationStats.totalUsers === 0) {
      await log('ℹ️  No users found to migrate');
      return;
    }

    // Migrate in batches
    let processed = 0;
    let batchNumber = 1;

    while (processed < migrationStats.totalUsers) {
      await log(`📦 Processing batch ${batchNumber} (users ${processed + 1}-${Math.min(processed + BATCH_SIZE, migrationStats.totalUsers)})...`);
      
      const batchProcessed = await migrateUsersBatch(processed, BATCH_SIZE, dryRun);
      processed += batchProcessed;
      batchNumber++;

      // Progress update
      const progress = Math.round((processed / migrationStats.totalUsers) * 100);
      await log(`📈 Progress: ${processed}/${migrationStats.totalUsers} users processed (${progress}%)`);

      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

  } catch (error) {
    await logError(error, 'Main migration process');
    throw error;
  } finally {
    migrationStats.endTime = new Date();
    const duration = (migrationStats.endTime - migrationStats.startTime) / 1000;
    
    await log('📊 Migration Summary:');
    await log(`   Total users: ${migrationStats.totalUsers}`);
    await log(`   Migrated: ${migrationStats.migratedUsers}`);
    await log(`   Skipped: ${migrationStats.skippedUsers}`);
    await log(`   Errors: ${migrationStats.errorUsers}`);
    await log(`   Duration: ${duration.toFixed(2)} seconds`);
    
    if (migrationStats.errors.length > 0) {
      await log(`⚠️  ${migrationStats.errors.length} errors occurred. Check ${ERROR_LOG_FILE} for details.`);
    }
  }
}

// Validate migration results
async function validateMigration() {
  await log('🔍 Validating migration results...');

  try {
    const mongoCount = await MongoUser.countDocuments();
    const pgCount = await SequelizeUser.count();

    await log(`📊 Validation Results:`);
    await log(`   MongoDB users: ${mongoCount}`);
    await log(`   PostgreSQL users: ${pgCount}`);

    if (mongoCount === pgCount) {
      await log('✅ Migration validation PASSED - User counts match');
    } else {
      await log('⚠️  Migration validation WARNING - User counts do not match');
    }

    // Sample data validation
    const sampleMongoUsers = await MongoUser.find().limit(5).lean();
    
    for (const mongoUser of sampleMongoUsers) {
      const pgUser = await SequelizeUser.findByPk(mongoUser._id.toString());
      
      if (!pgUser) {
        await log(`❌ Sample validation FAILED - User ${mongoUser.email} not found in PostgreSQL`);
        continue;
      }

      // Check key fields
      const fieldsMatch = 
        pgUser.firstName === mongoUser.firstName &&
        pgUser.lastName === mongoUser.lastName &&
        pgUser.email === mongoUser.email &&
        pgUser.role === (mongoUser.role || 'user');

      if (fieldsMatch) {
        await log(`✅ Sample validation PASSED - User ${mongoUser.email}`);
      } else {
        await log(`❌ Sample validation FAILED - User ${mongoUser.email} data mismatch`);
      }
    }

  } catch (error) {
    await logError(error, 'Migration validation');
    throw error;
  }
}

// Rollback migration (if needed)
async function rollbackMigration() {
  await log('⚠️  ROLLBACK: This will delete all users from PostgreSQL!');
  await log('Press Ctrl+C within 10 seconds to cancel...');
  
  await new Promise(resolve => setTimeout(resolve, 10000));

  try {
    const deletedCount = await SequelizeUser.destroy({ where: {} });
    await log(`🗑️  Rollback complete: Deleted ${deletedCount} users from PostgreSQL`);
  } catch (error) {
    await logError(error, 'Rollback');
    throw error;
  }
}

// Show help
function showHelp() {
  console.log(`
IVMA App User Migration Script

Usage: node scripts/migrate-users.js [command]

Commands:
  --dry-run     Preview migration without executing changes
  --migrate     Execute the user migration from MongoDB to PostgreSQL
  --validate    Validate migration results by comparing counts and sample data
  --rollback    Delete all users from PostgreSQL (DESTRUCTIVE)
  --help        Show this help message

Examples:
  node scripts/migrate-users.js --dry-run
  node scripts/migrate-users.js --migrate
  node scripts/migrate-users.js --validate

Logs:
  Migration logs: ${LOG_FILE}
  Error logs: ${ERROR_LOG_FILE}

Environment Variables Required:
  MONGODB_URI
  SUPABASE_DB_URL (or individual SUPABASE_DB_* variables)
`);
}

// Main function
async function main() {
  console.log('👥 IVMA App User Migration Tool\n');

  try {
    switch (command) {
      case '--dry-run':
        await initializeConnections();
        await migrateUsers(true);
        break;

      case '--migrate':
        await initializeConnections();
        await migrateUsers(false);
        break;

      case '--validate':
        await initializeConnections();
        await validateMigration();
        break;

      case '--rollback':
        await initializeConnections();
        await rollbackMigration();
        break;

      case '--help':
      case undefined:
        showHelp();
        return;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
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

// Handle process signals
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted by user');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});