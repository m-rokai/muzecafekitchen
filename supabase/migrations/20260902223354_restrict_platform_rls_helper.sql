-- Supabase creates this event-trigger helper on new projects. It must remain
-- available to the database event trigger, but it is not an application RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
