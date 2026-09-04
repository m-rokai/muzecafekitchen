import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  console.warn('Supabase client environment variables are not configured.');
}

export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  publishableKey || 'missing-publishable-key',
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);
