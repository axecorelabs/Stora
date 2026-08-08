import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

async function fixWishlistIndex() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('wishlists');

    // 1. Get existing indexes
    console.log('📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? '(unique)' : '');
    });
    console.log('');

    // 2. Drop the problematic shareCode index
    console.log('🗑️  Attempting to drop shareCode_1 index...');
    try {
      await collection.dropIndex('shareCode_1');
      console.log('✅ Successfully dropped shareCode_1 index\n');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index shareCode_1 does not exist (already dropped)\n');
      } else {
        console.log('⚠️  Error dropping index:', error.message, '\n');
      }
    }

    // 3. Try dropping sparse version if it exists
    try {
      await collection.dropIndex('shareCode_1_sparse');
      console.log('✅ Dropped existing shareCode_1_sparse index\n');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index shareCode_1_sparse does not exist\n');
      }
    }

    // 4. Create the new sparse index
    console.log('➕ Creating new sparse index for shareCode...');
    await collection.createIndex(
      { shareCode: 1 }, 
      { 
        unique: true, 
        sparse: true, 
        name: 'shareCode_1_sparse' 
      }
    );
    console.log('✅ Created new sparse index: shareCode_1_sparse\n');

    // 5. Verify new indexes
    console.log('📋 Updated indexes:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key), 
        idx.unique ? '(unique)' : '', 
        idx.sparse ? '(sparse)' : ''
      );
    });

    console.log('\n✅ Migration completed successfully!');
    console.log('🎉 Wishlist system should now work correctly.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

fixWishlistIndex();
