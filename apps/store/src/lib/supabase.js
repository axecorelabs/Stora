import { createClient } from '@supabase/supabase-js';

// Support both NEXT_PUBLIC_ prefixed vars (Next.js) and non-prefixed (scripts)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client-side Supabase client (only create if we have the keys)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Server-side client with service role
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Connection function to ensure compatibility with MongoDB connection pattern
async function connectToSupabase() {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Missing environment variables.');
  }

  try {
    // Test connection
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is OK
      throw error;
    }
    return supabase;
  } catch (error) {
    console.error('Supabase connection error:', error);
    throw error;
  }
}

export default connectToSupabase;