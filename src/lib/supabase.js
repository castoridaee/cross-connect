import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validation check
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ENVIRONMENT ERROR: Check .env.local placement.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true, // Ensures session is saved in localStorage
    autoRefreshToken: true,
  }
});