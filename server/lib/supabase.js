import { createClient } from '@supabase/supabase-js';

let authClient;
let adminClient;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function serverClientOptions() {
  return {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  };
}

export function getSupabaseAuthClient() {
  if (!authClient) {
    authClient = createClient(
      required('SUPABASE_URL'),
      required('SUPABASE_PUBLISHABLE_KEY'),
      serverClientOptions(),
    );
  }
  return authClient;
}

export function getSupabaseAdminClient() {
  if (!adminClient) {
    adminClient = createClient(
      required('SUPABASE_URL'),
      required('SUPABASE_SECRET_KEY'),
      serverClientOptions(),
    );
  }
  return adminClient;
}

export async function verifyAccessToken(token) {
  const { data, error } = await getSupabaseAuthClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
