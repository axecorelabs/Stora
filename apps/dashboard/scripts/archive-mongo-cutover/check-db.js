import dotenv from 'dotenv';
import { Client } from 'pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function checkDB() {
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check if tables exist
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE 'item_sale%' 
      AND table_schema = 'public'
    `);
    console.log('ItemSale tables:', tables.rows.map(r => r.table_name));
    
    // Check enum types
    try {
      const enums = await client.query(`
        SELECT unnest(enum_range(NULL::enum_item_sales_payment_method)) as method
      `);
      console.log('Payment method enum values:', enums.rows.map(r => r.method));
    } catch (error) {
      console.log('Enum does not exist or error:', error.message);
    }
    
  } catch (error) {
    console.log('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDB();