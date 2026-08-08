#!/usr/bin/env node

import dotenv from 'dotenv';
import { Sequelize, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Initialize Sequelize (same as other migration scripts)
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

// Define Session model (identical to migrate-sessions.js)
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

// Define TempUser model
const TempUser = sequelize.define('TempUser', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  firstName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'first_name',
  },
  lastName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'last_name',
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  verificationCode: {
    type: DataTypes.STRING(6),
    allowNull: false,
    field: 'verification_code',
  },
  verificationCodeExpires: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'verification_code_expires',
  },
  resendCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'resend_count',
  },
  lastResendAt: {
    type: DataTypes.DATE,
    field: 'last_resend_at',
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    field: 'ip_address',
  },
  userAgent: {
    type: DataTypes.TEXT,
    field: 'user_agent',
  },
}, {
  tableName: 'temp_users',
  underscored: true,
  timestamps: true,
  indexes: [
    {
      fields: ['email'],
      unique: true,
    },
    {
      fields: ['verification_code'],
    },
    {
      fields: ['verification_code_expires'],
    },
  ],
});

async function createAuthTables() {
  try {
    console.log('🔄 Creating authentication tables...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Sync Session table (using exact same model as migrate-sessions.js)
    console.log('📋 Creating sessions table...');
    await Session.sync({ force: false });
    console.log('✅ sessions table ready');
    
    // Sync TempUser table  
    console.log('📋 Creating temp_users table...');
    await TempUser.sync({ force: false });
    console.log('✅ temp_users table ready');
    
    console.log('🎉 Authentication tables created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating auth tables:', error);
    throw error;
  } finally {
    try {
      await sequelize.close();
      console.log('📝 PostgreSQL connection closed');
    } catch (closeError) {
      console.error('Error closing connection:', closeError);
    }
  }
}

createAuthTables().catch(error => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});