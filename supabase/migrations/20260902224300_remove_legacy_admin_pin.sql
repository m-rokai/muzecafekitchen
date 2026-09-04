-- Supabase Auth roles replace the legacy plaintext PIN authentication flow.
delete from public.settings where key = 'admin_pin';
