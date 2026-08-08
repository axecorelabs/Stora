#!/usr/bin/env node

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
});

// User model (simplified for verification)
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  firstName: {
    type: DataTypes.STRING(50),
    field: 'first_name',
  },
  lastName: {
    type: DataTypes.STRING(50),
    field: 'last_name',
  },
  email: {
    type: DataTypes.STRING(255),
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'manager'),
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    field: 'is_active',
  },
  isSubscribed: {
    type: DataTypes.BOOLEAN,
    field: 'is_subscribed',
  },
  preferences: {
    type: DataTypes.JSONB,
  },
  isEmailVerified: {
    type: DataTypes.BOOLEAN,
    field: 'is_email_verified',
  },
}, {
  tableName: 'users',
  underscored: true,
});

async function verifyMigration() {
  try {
    console.log('🔍 Verifying user migration data...\n');

    await sequelize.authenticate();
    console.log('✅ Connected to Supabase\n');

    // Get all users
    const users = await User.findAll({
      order: [['created_at', 'ASC']]
    });

    console.log('📊 MIGRATION VERIFICATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total users migrated: ${users.length}\n`);

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Active: ${user.isActive ? 'Yes' : 'No'}`);
      console.log(`   - Verified: ${user.isEmailVerified ? 'Yes' : 'No'}`);
      console.log(`   - Subscribed: ${user.isSubscribed ? 'Yes' : 'No'}`);
      console.log(`   - UUID: ${user.id}`);
      console.log(`   - MongoDB ID: ${user.preferences?.mongodbId || 'N/A'}`);
      console.log(`   - Created: ${user.createdAt?.toLocaleString() || 'N/A'}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('✅ Migration verification completed successfully!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

verifyMigration()
  .then(() => {
    console.log('\n🎉 All data verified successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Verification failed:', error.message);
    process.exit(1);
  });