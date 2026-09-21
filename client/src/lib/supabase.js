import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  console.warn('Supabase client environment variables are not configured.');
}

let durableStorage;
try {
  durableStorage = typeof window === 'undefined' ? undefined : window.localStorage;
} catch {
  // Supabase falls back to in-memory storage when a browser blocks localStorage.
}

export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  publishableKey || 'missing-publishable-key',
  {
    auth: {
      // Browser-only app: links can open on a different device or browser.
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      ...(durableStorage ? { storage: durableStorage } : {}),
    },
  },
);
