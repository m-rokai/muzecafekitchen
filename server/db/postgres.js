import postgres from 'postgres';

let client;

export function getSql() {
  if (!client) {
    const connectionString = process.env.SUPABASE_DATABASE_URL?.trim();
    if (!connectionString) throw new Error('SUPABASE_DATABASE_URL is required');
    client = postgres(connectionString, {
      max: Number(process.env.POSTGRES_POOL_SIZE || 3),
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
      transform: { undefined: null },
    });
  }
  return client;
}

export async function closeDatabase() {
  if (!client) return;
  await client.end({ timeout: 5 });
  client = undefined;
}
