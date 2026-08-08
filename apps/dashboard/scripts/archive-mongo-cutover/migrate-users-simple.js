#!/usr/bin/env node

import mongoose from 'mongoose';
import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
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

// MongoDB User Schema (matching your existing model)
const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  password: String,
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  role: { type: String, default: 'user' },
  isSubscribed: { type: Boolean, default: false },
  dateSubscribed: Date,
  currentSubscription: mongoose.Schema.Types.ObjectId,
  preferences: { type: Object, default: {} },
  avatar: String,
  isVerified: { type: Boolean, default: false },
  verificationToken: String,
  verificationTokenExpiry: Date,
}, { timestamps: true });

const MongoUser = mongoose.models.User || mongoose.model('User', UserSchema);

// Sequelize User Model (matching your PostgreSQL schema)
const SequelizeUser = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'first_name',
  },
  lastName: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'last_name',
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'manager'),
    defaultValue: 'user',
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  lastLogin: {
    type: DataTypes.DATE,
    field: 'last_login',
  },
  isSubscribed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_subscribed',
  },
  dateSubscribed: {
    type: DataTypes.DATE,
    field: 'date_subscribed',
  },
  currentSubscriptionId: {
    type: DataTypes.UUID,
    field: 'current_subscription_id',
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  avatar: {
    type: DataTypes.TEXT,
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_email_verified',
  },
  emailVerificationToken: {
    type: DataTypes.STRING,
    field: 'email_verification_token',
  },
  emailVerificationExpiry: {
    type: DataTypes.DATE,
    field: 'email_verification_expiry',
  },
}, {
  tableName: 'users',
  underscored: true,
  timestamps: true,
});

// Batch size for processing
const BATCH_SIZE = 100;

async function migrateUsers() {
  try {
    console.log('🚀 Starting user migration from MongoDB to Supabase...\n');

    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Test Sequelize connection
    console.log('🔗 Testing Supabase connection...');
    await sequelize.authenticate();
    console.log('✅ Connected to Supabase\n');

    // Create table if it doesn't exist
    console.log('📋 Creating users table if it doesn\'t exist...');
    await SequelizeUser.sync();
    console.log('✅ Table ready\n');

    // Fetch all users from MongoDB
    console.log('📥 Fetching users from MongoDB...');
    const mongoUsers = await MongoUser.find({}).lean();
    console.log(`✅ Found ${mongoUsers.length} users in MongoDB\n`);

    if (mongoUsers.length === 0) {
      console.log('⚠️  No users to migrate. Exiting...');
      return;
    }

    // Migration statistics
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    console.log(`🔄 Starting batch migration (${BATCH_SIZE} users per batch)...\n`);

    // Process users in batches
    const totalBatches = Math.ceil(mongoUsers.length / BATCH_SIZE);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, mongoUsers.length);
      const batch = mongoUsers.slice(batchStart, batchEnd);
      
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${totalBatches} (users ${batchStart + 1}-${batchEnd})...`);

      // Get all emails in this batch
      const batchEmails = batch.map(u => u.email ? u.email.toLowerCase() : '');
      
      // Check which users already exist (bulk query)
      const existingUsers = await SequelizeUser.findAll({
        where: { 
          email: batchEmails.filter(email => email) // Filter out empty emails
        },
        attributes: ['email']
      });
      
      const existingEmailsSet = new Set(existingUsers.map(u => u.email));
      
      // Filter out users that already exist
      const usersToInsert = batch.filter(u => {
        if (!u.email || !u.firstName || !u.lastName) return false;
        return !existingEmailsSet.has(u.email.toLowerCase());
      });
      
      const batchSkipped = batch.length - usersToInsert.length;
      skippedCount += batchSkipped;
      
      if (batchSkipped > 0) {
        console.log(`⏭️  Skipping ${batchSkipped} users (already exist or missing required fields)`);
      }

      if (usersToInsert.length === 0) {
        console.log(`✅ Batch ${batchIndex + 1} complete (all users skipped)`);
        continue;
      }

      // Prepare data for bulk insert
      const usersData = usersToInsert.map(mongoUser => ({
        // Generate a new UUID instead of using MongoDB ObjectId
        // Store the original MongoDB ID in a metadata field if needed
        firstName: mongoUser.firstName,
        lastName: mongoUser.lastName,
        email: mongoUser.email.toLowerCase(),
        passwordHash: mongoUser.password || 'temp_password_' + Math.random().toString(36),
        role: mongoUser.role || 'user',
        isActive: mongoUser.isActive !== false,
        lastLogin: mongoUser.lastLogin || null,
        isSubscribed: mongoUser.isSubscribed || false,
        dateSubscribed: mongoUser.dateSubscribed || null,
        currentSubscriptionId: null, // Set to null for now, will need to be mapped after subscription migration
        preferences: {
          ...mongoUser.preferences || {},
          mongodbId: mongoUser._id.toString(), // Store original MongoDB ID for reference
          originalCurrentSubscription: mongoUser.currentSubscription?.toString() || null // Store for later mapping
        },
        avatar: mongoUser.avatar || null,
        isEmailVerified: mongoUser.isVerified || false,
        emailVerificationToken: mongoUser.verificationToken || null,
        emailVerificationExpiry: mongoUser.verificationTokenExpiry || null,
        createdAt: mongoUser.createdAt || new Date(),
        updatedAt: mongoUser.updatedAt || new Date()
      }));

      try {
        // Use bulk create with ignoreDuplicates option
        const result = await SequelizeUser.bulkCreate(usersData, {
          ignoreDuplicates: true,
          validate: true,
        });

        successCount += result.length;
        console.log(`✅ Batch ${batchIndex + 1} complete: ${result.length} users inserted`);

      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} failed: ${error.message}`);
        
        // Try inserting one by one to identify problem records
        for (const userData of usersData) {
          try {
            await SequelizeUser.create(userData);
            successCount++;
          } catch (individualError) {
            console.error(`❌ Failed to insert user ${userData.email}: ${individualError.message}`);
            errors.push({ email: userData.email, error: individualError.message });
            errorCount++;
          }
        }
      }
      
      // Small delay between batches to avoid overwhelming the database
      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total users in MongoDB: ${mongoUsers.length}`);
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`⏭️  Skipped (already exist/invalid): ${skippedCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('='.repeat(60));

    // Print errors if any
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n❌ ERRORS:');
      errors.forEach(({ email, error }, index) => {
        console.log(`${index + 1}. ${email}: ${error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ Too many errors (${errors.length}). First 10:`);
      errors.slice(0, 10).forEach(({ email, error }, index) => {
        console.log(`${index + 1}. ${email}: ${error}`);
      });
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const supabaseUserCount = await SequelizeUser.count();
    console.log(`✅ Total users in Supabase: ${supabaseUserCount}`);

    if (successCount + skippedCount >= mongoUsers.length) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review above.');
    }

  } catch (error) {
    console.error('\n💥 Migration failed with error:', error);
    throw error;
  } finally {
    // Cleanup connections
    await mongoose.disconnect();
    await sequelize.close();
    console.log('\n👋 Disconnected from databases');
  }
}

// Check command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === '--help' || !command) {
  console.log(`
IVMA App User Migration Script (Simplified)

Usage: node scripts/migrate-users-simple.js [command]

Commands:
  migrate    Execute the user migration
  --help     Show this help message

Example:
  node scripts/migrate-users-simple.js migrate

Environment Variables Required:
  MONGODB_URI
  SUPABASE_DB_URL or individual SUPABASE_DB_* variables
`);
  process.exit(0);
}

if (command === 'migrate') {
  // Run migration
  migrateUsers()
    .then(() => {
      console.log('\n✨ Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
} else {
  console.error(`❌ Unknown command: ${command}`);
  console.log('Use --help for usage information');
  process.exit(1);
}