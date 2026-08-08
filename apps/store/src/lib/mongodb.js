// MongoDB connection disabled - migrated to Supabase
// This file is kept for backward compatibility with unmigrated routes
// TODO: Remove this file once all routes are migrated to Supabase

async function connectDB() {
  // No-op function - MongoDB connection disabled
  console.warn('⚠️ MongoDB connection called but disabled. Please migrate this route to Supabase.');
  return null;
}

export default connectDB;
