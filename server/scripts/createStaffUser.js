import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabase.js';

const email = process.env.STAFF_EMAIL?.trim();
const password = process.env.STAFF_PASSWORD;
const role = process.env.STAFF_ROLE?.trim() || 'staff';

if (!email || !password) throw new Error('STAFF_EMAIL and STAFF_PASSWORD are required');
if (!['staff', 'admin'].includes(role)) throw new Error('STAFF_ROLE must be staff or admin');

const { data, error } = await getSupabaseAdminClient().auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  app_metadata: { role },
});

if (error) throw error;
console.log(`Created ${role} user ${data.user.email} (${data.user.id}).`);
