// Supabase client. Configuration is read from environment variables so the
// app can point at any project (e.g. a fresh empty database) by editing .env
// instead of editing code.
//
// Set these in your .env file:
//   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon/publishable-key>
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // Fail loudly in development if env vars are missing.
  throw new Error(
    'Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env file.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
