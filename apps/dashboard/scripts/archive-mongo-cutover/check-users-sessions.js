#!/usr/bin/env node

import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
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

async function checkUsersAndSessions() {
  try {
    await sequelize.authenticate();
    console.log('🔍 Checking users and sessions in database...');
    
    const [users] = await sequelize.query('SELECT id, email, first_name, last_name, role, is_active, created_at FROM users LIMIT 10');
    console.log('📊 Found users:', users.length);
    users.forEach(user => {
      console.log('  - ', user.email, 'Role:', user.role, 'Active:', user.is_active);
    });
    
    console.log('\n🔑 Checking sessions...');
    const [sessions] = await sequelize.query('SELECT session_id, user_id, expires_at, created_at FROM sessions ORDER BY created_at DESC LIMIT 5');
    console.log('📊 Found sessions:', sessions.length);
    sessions.forEach(session => {
      console.log('  - Session:', session.session_id, 'User:', session.user_id, 'Expires:', session.expires_at);
    });
    
    if (users.length === 0) {
      console.log('\n❓ No users found. You need to sign up first.');
    }
    if (sessions.length === 0) {
      console.log('\n❓ No sessions found. You need to sign in first.');
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkUsersAndSessions();