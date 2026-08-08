#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('Environment check:');
console.log('- SUPABASE_DB_URL:', process.env.SUPABASE_DB_URL?.substring(0, 50) + '...');
console.log('- DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

// Test direct sequelize connection
import { Sequelize } from 'sequelize';

const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
console.log('- Using URL:', databaseUrl?.substring(0, 50) + '...');

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: false,
    connectTimeout: 60000,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

try {
  console.log('\n🔗 Testing direct Sequelize connection...');
  await sequelize.authenticate();
  console.log('✅ Direct connection successful!');
  
  console.log('\n🔍 Testing query...');
  const result = await sequelize.query('SELECT 1 as test');
  console.log('✅ Query successful:', result);
  
} catch (error) {
  console.error('❌ Connection failed:', error.message);
  console.error('Full error:', error);
} finally {
  await sequelize.close();
}