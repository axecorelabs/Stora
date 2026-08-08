#!/usr/bin/env node

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Sequelize, DataTypes } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
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

// Define Customer model (inline for migration)
const Customer = sequelize.define('Customer', {
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
  },
  passwordHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
  },
  phone: {
    type: DataTypes.STRING(20),
  },
  dateOfBirth: {
    type: DataTypes.DATEONLY,
    field: 'date_of_birth',
  },
  gender: {
    type: DataTypes.ENUM('male', 'female', 'other', 'prefer-not-to-say'),
    defaultValue: 'prefer-not-to-say',
  },
  avatar: {
    type: DataTypes.TEXT,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_verified',
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
  verificationToken: {
    type: DataTypes.STRING,
    field: 'verification_token',
  },
  verificationTokenExpiry: {
    type: DataTypes.DATE,
    field: 'verification_token_expiry',
  },
  passwordResetToken: {
    type: DataTypes.STRING,
    field: 'password_reset_token',
  },
  passwordResetExpiry: {
    type: DataTypes.DATE,
    field: 'password_reset_expiry',
  },
  preferences: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  totalOrders: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_orders',
  },
  totalSpent: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'total_spent',
  },
  averageOrderValue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0,
    field: 'average_order_value',
  },
  lastOrderDate: {
    type: DataTypes.DATE,
    field: 'last_order_date',
  },
  loyaltyPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'loyalty_points',
  },
  customerTier: {
    type: DataTypes.ENUM('bronze', 'silver', 'gold', 'platinum'),
    defaultValue: 'bronze',
    field: 'customer_tier',
  },
}, {
  tableName: 'customers',
  underscored: true,
  timestamps: true,
});

// Define CustomerAddress model (inline for migration)
const CustomerAddress = sequelize.define('CustomerAddress', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'customer_id',
  },
  type: {
    type: DataTypes.ENUM('home', 'work', 'other'),
    defaultValue: 'home',
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_default',
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
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  street: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  state: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  country: {
    type: DataTypes.STRING(100),
    defaultValue: 'Nigeria',
  },
  postalCode: {
    type: DataTypes.STRING(20),
    field: 'postal_code',
  },
  landmark: {
    type: DataTypes.STRING(255),
  },
  coordinates: {
    type: DataTypes.JSONB,
  },
}, {
  tableName: 'customer_addresses',
  underscored: true,
  timestamps: true,
});

// Transform MongoDB customer to PostgreSQL structure
function transformCustomerData(mongoDoc) {
  const customerId = uuidv4();
  
  // Main customer data
  const customerData = {
    id: customerId,
    mongoId: mongoDoc._id?.toString(),
    firstName: mongoDoc.firstName || '',
    lastName: mongoDoc.lastName || '',
    email: mongoDoc.email?.toLowerCase() || '',
    passwordHash: mongoDoc.password || '', // Will be hashed if needed
    phone: mongoDoc.phone || null,
    dateOfBirth: mongoDoc.dateOfBirth || null,
    gender: mongoDoc.gender || 'prefer-not-to-say',
    avatar: mongoDoc.avatar || null,
    isVerified: mongoDoc.isVerified || false,
    isActive: mongoDoc.isActive !== false, // Default to true if not specified
    lastLogin: mongoDoc.lastLogin || null,
    verificationToken: mongoDoc.verificationToken || null,
    verificationTokenExpiry: mongoDoc.verificationTokenExpiry || null,
    passwordResetToken: mongoDoc.passwordResetToken || null,
    passwordResetExpiry: mongoDoc.passwordResetExpiry || null,
    preferences: {
      mongodbId: mongoDoc._id?.toString(),
      notifications: mongoDoc.preferences?.notifications || {},
      marketing: mongoDoc.preferences?.marketing || {},
      privacy: mongoDoc.preferences?.privacy || {},
      currency: mongoDoc.preferences?.currency || 'NGN',
      language: mongoDoc.preferences?.language || 'en',
      newsletter: mongoDoc.preferences?.newsletter || false,
      smsNotifications: mongoDoc.preferences?.smsNotifications || false,
      emailNotifications: mongoDoc.preferences?.emailNotifications || true,
      favoriteCategories: mongoDoc.preferences?.favoriteCategories || []
    },
    totalOrders: mongoDoc.shoppingStats?.totalOrders || 0,
    totalSpent: mongoDoc.shoppingStats?.totalSpent || 0,
    averageOrderValue: mongoDoc.shoppingStats?.averageOrderValue || 0,
    lastOrderDate: mongoDoc.shoppingStats?.lastOrderDate || null,
    loyaltyPoints: mongoDoc.loyaltyPoints || 0,
    customerTier: determineCustomerTier(mongoDoc.shoppingStats?.totalSpent || 0),
    createdAt: mongoDoc.createdAt || new Date(),
    updatedAt: mongoDoc.updatedAt || new Date(),
  };

  // Address data (normalized from embedded addresses)
  const addresses = [];
  if (mongoDoc.addresses && Array.isArray(mongoDoc.addresses)) {
    mongoDoc.addresses.forEach((address, index) => {
      if (address.street && address.city && address.state) {
        addresses.push({
          customerId,
          type: address.type || 'home',
          isDefault: address.isDefault || index === 0, // First address is default
          firstName: address.firstName || mongoDoc.firstName || '',
          lastName: address.lastName || mongoDoc.lastName || '',
          phone: address.phone || mongoDoc.phone || '',
          street: address.street,
          city: address.city,
          state: address.state,
          country: address.country || 'Nigeria',
          postalCode: address.postalCode || null,
          landmark: address.landmark || null,
          coordinates: null, // Can be added later if needed
        });
      }
    });
  }

  return {
    customer: customerData,
    addresses
  };
}

function determineCustomerTier(totalSpent) {
  if (totalSpent >= 500000) return 'platinum';
  if (totalSpent >= 200000) return 'gold';
  if (totalSpent >= 50000) return 'silver';
  return 'bronze';
}

async function migrateCustomers() {
  let mongoClient;
  
  try {
    console.log('🔄 Starting customer migration...');
    
    // Test PostgreSQL connection
    console.log('🔗 Testing PostgreSQL connection...');
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connection successful');
    
    // Create tables if they don't exist
    console.log('📋 Creating customer tables...');
    await Customer.sync({ force: false });
    await CustomerAddress.sync({ force: false });
    console.log('✅ Customer tables ready');
    
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db();
    console.log('✅ MongoDB connection successful');
    
    // Get total count
    const totalCount = await db.collection('customers').countDocuments();
    console.log(`📊 Found ${totalCount} customers to migrate`);
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No data will be written');
      
      // Show sample transformation
      const sampleDocs = await db.collection('customers').find({}).limit(3).toArray();
      for (const doc of sampleDocs) {
        const transformed = transformCustomerData(doc);
        console.log('\n📄 Sample transformation:');
        console.log(`MongoDB Customer: ${doc.firstName} ${doc.lastName} (${doc.email})`);
        console.log(`PostgreSQL Customer: ${transformed.customer.firstName} ${transformed.customer.lastName}`);
        console.log(`Addresses: ${transformed.addresses.length}`);
      }
      
      return;
    }
    
    // Check for existing data
    const existingCount = await Customer.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing customers. Skipping duplicates by mongoId.`);
    }
    
    // Process customers in batches
    let processedCount = 0;
    let migratedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    const cursor = db.collection('customers').find({});
    
    const customers = await cursor.toArray();
    
    for (let i = 0; i < customers.length; i += BATCH_SIZE) {
      const batch = customers.slice(i, i + BATCH_SIZE);
      
      for (const mongoDoc of batch) {
        try {
          processedCount++;
          
          // Skip if already exists
          const existing = await Customer.findOne({ where: { mongoId: mongoDoc._id?.toString() } });
          if (existing) {
            console.log(`⏭️  Skipping existing customer: ${mongoDoc.email}`);
            continue;
          }
          
          const transformedData = transformCustomerData(mongoDoc);
          
          // Hash password if it's not already hashed
          if (transformedData.customer.passwordHash && !transformedData.customer.passwordHash.startsWith('$')) {
            transformedData.customer.passwordHash = await bcrypt.hash(transformedData.customer.passwordHash, 12);
          }
          
          // Use transaction for consistency
          await sequelize.transaction(async (t) => {
            // Create customer
            const customer = await Customer.create(transformedData.customer, { transaction: t });
            
            // Create addresses
            for (const addressData of transformedData.addresses) {
              await CustomerAddress.create(addressData, { transaction: t });
            }
          });
          
          migratedCount++;
          
          if (migratedCount % 10 === 0) {
            console.log(`✅ Migrated: ${migratedCount}/${totalCount} customers`);
          }
          
        } catch (error) {
          errorCount++;
          const errorInfo = {
            mongoId: mongoDoc._id?.toString(),
            email: mongoDoc.email,
            error: error.message
          };
          errors.push(errorInfo);
          
          console.error(`❌ Error migrating customer ${mongoDoc.email}:`, error.message);
          
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
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${processedCount}/${totalCount}`);
    
    if (errors.length > 0 && errors.length <= 10) {
      console.log('\n❌ Error details:');
      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.email} (${error.mongoId}): ${error.error}`);
      });
    } else if (errors.length > 10) {
      console.log(`\n❌ ${errors.length} errors occurred. First 10:`);
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error.email} (${error.mongoId}): ${error.error}`);
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
    console.log('  node scripts/migrate-customers.js migrate [--dry-run]');
    console.log('  node scripts/migrate-customers.js --dry-run  # Preview migration');
    process.exit(1);
  }
  
  if (command === 'migrate' || command === '--dry-run') {
    await migrateCustomers();
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

export default { Customer, CustomerAddress };