#!/usr/bin/env node

/**
 * Database Setup Script for IVMA App
 * This script initializes the PostgreSQL database with Sequelize models
 * 
 * Usage:
 *   node scripts/setup-db.js --init        # Initialize database
 *   node scripts/setup-db.js --seed        # Seed with sample data
 *   node scripts/setup-db.js --reset       # Reset database (DESTRUCTIVE)
 *   node scripts/setup-db.js --migrate     # Run migrations
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sequelize from '../src/lib/sequelize.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

// Import models after env is loaded
let modelsLoaded = false;
let models = {};

async function loadModels() {
  if (modelsLoaded) return models;
  
  try {
    const { initializeDatabase, seedDefaultData, User } = await import('../src/models/sequelize/index.js');
    models = { initializeDatabase, seedDefaultData, User };
    modelsLoaded = true;
    return models;
  } catch (error) {
    console.error('Failed to load models:', error.message);
    throw error;
  }
}

const args = process.argv.slice(2);
const command = args[0];

async function initDatabase() {
  console.log('🚀 Initializing PostgreSQL database...');
  
  try {
    const { initializeDatabase } = await loadModels();
    await initializeDatabase(false);
    console.log('✅ Database initialized successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

async function seedDatabase() {
  console.log('🌱 Seeding database with default data...');
  
  try {
    const { seedDefaultData } = await loadModels();
    await seedDefaultData();
    console.log('✅ Database seeded successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    process.exit(1);
  }
}

async function resetDatabase() {
  console.log('⚠️  RESETTING DATABASE - ALL DATA WILL BE LOST!');
  console.log('This action cannot be undone. Press Ctrl+C to cancel.');
  
  // Wait for 5 seconds to allow cancellation
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    const { initializeDatabase } = await loadModels();
    await initializeDatabase(true); // force = true
    console.log('✅ Database reset completed!');
  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    process.exit(1);
  }
}

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Show connection details (without sensitive info)
    const config = sequelize.config;
    console.log(`📍 Connected to: ${config.host}:${config.port}/${config.database}`);
    console.log(`👤 User: ${config.username}`);
    console.log(`🔧 Dialect: ${config.dialect}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

async function showHelp() {
  console.log(`
IVMA App Database Setup Script

Usage: node scripts/setup-db.js [command]

Commands:
  --init      Initialize database tables and relationships
  --seed      Seed database with default data (notification templates, etc.)
  --reset     Reset database (DESTRUCTIVE - removes all data)
  --test      Test database connection
  --help      Show this help message

Examples:
  node scripts/setup-db.js --init
  node scripts/setup-db.js --seed
  node scripts/setup-db.js --test

Environment Variables Required:
  SUPABASE_DB_URL or individual SUPABASE_DB_* variables
  See .env.example for details.
`);
}

async function main() {
  console.log('🏪 IVMA App Database Setup\n');
  
  switch (command) {
    case '--init':
      await testConnection();
      await initDatabase();
      break;
      
    case '--seed':
      await testConnection();
      await seedDatabase();
      break;
      
    case '--reset':
      await testConnection();
      await resetDatabase();
      break;
      
    case '--test':
      await testConnection();
      break;
      
    case '--migrate':
      await testConnection();
      await initDatabase();
      await seedDatabase();
      break;
      
    case '--help':
    case undefined:
      await showHelp();
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      await showHelp();
      process.exit(1);
  }
  
  // Close the connection
  await sequelize.close();
  console.log('👋 Database connection closed.');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});