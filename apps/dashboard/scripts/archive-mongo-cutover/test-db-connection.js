#!/usr/bin/env node

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

console.log('🔧 Testing Supabase connection...\n');

// Print connection details (safely)
console.log('Environment check:');
console.log('- DATABASE_URL present:', !!process.env.DATABASE_URL);
console.log('- SUPABASE URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('- Service role key present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

if (process.env.DATABASE_URL) {
  // Parse the URL to show connection details (without password)
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log('- Host:', url.hostname);
    console.log('- Port:', url.port);
    console.log('- Database:', url.pathname.substring(1));
    console.log('- Username:', url.username);
  } catch (error) {
    console.log('- Could not parse DATABASE_URL');
  }
}

console.log('\n🔗 Attempting connection...');

// Initialize Sequelize with DATABASE_URL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    },
  },
  logging: (msg) => console.log('  [SQL]:', msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

async function testConnection() {
  try {
    // Test authentication
    await sequelize.authenticate();
    console.log('✅ Connection established successfully!');
    
    // Test a simple query
    const [results] = await sequelize.query('SELECT version()');
    console.log('✅ Query test successful!');
    console.log('   PostgreSQL version:', results[0].version.split(' ')[0]);
    
    // Check if we can create a test table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS connection_test (
        id SERIAL PRIMARY KEY,
        test_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Table creation test successful!');
    
    // Insert and select test data
    await sequelize.query(`
      INSERT INTO connection_test (test_message) VALUES ('Test connection successful')
    `);
    
    const [testResults] = await sequelize.query(`
      SELECT * FROM connection_test ORDER BY created_at DESC LIMIT 1
    `);
    console.log('✅ Insert/Select test successful!');
    console.log('   Last test message:', testResults[0].test_message);
    
    // Clean up
    await sequelize.query('DROP TABLE connection_test');
    console.log('✅ Cleanup successful!');
    
    console.log('\n🎉 All connection tests passed! Ready for migration.');
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('❌ Error details:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

testConnection()
  .then(() => {
    console.log('\n✨ Connection test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Connection test failed:', error.message);
    process.exit(1);
  });