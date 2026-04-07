/*
  # Recreate Admin User - Lucas Monte (Fixed)
  
  1. Delete existing incorrect user
    - Remove from auth.users, auth.identities, and system_users
  
  2. This migration prepares for proper user creation
    - The user should be created via the create-user edge function
    - Or manually via Supabase Dashboard
  
  Note: Direct password insertion into auth.users doesn't work with Supabase's auth system.
  The proper way is to use auth.admin.createUser() via edge functions or admin API.
*/

DO $$
BEGIN
  -- Delete from system_users first (has FK to auth.users)
  DELETE FROM system_users WHERE email = 'lucasmonte@fesfsus.ba.gov.br';
  
  -- Delete from auth.identities
  DELETE FROM auth.identities 
  WHERE user_id IN (
    SELECT id FROM auth.users WHERE email = 'lucasmonte@fesfsus.ba.gov.br'
  );
  
  -- Delete from auth.users
  DELETE FROM auth.users WHERE email = 'lucasmonte@fesfsus.ba.gov.br';
  
  RAISE NOTICE 'Previous user deleted. Ready for recreation via proper method.';
END $$;
