/*
  # Create Admin User - Lucas Monte
  
  1. Create authentication user
    - Email: lucasmonte@fesfsus.ba.gov.br
    - Password: Testit123
    - Email confirmed by default
  
  2. Create system user record
    - Full name: Lucas Monte
    - Role: Administrador (full permissions)
    - Active status
  
  3. Security
    - Uses secure password hashing
    - Email pre-confirmed for immediate access
*/

DO $$
DECLARE
  v_user_id uuid;
  v_admin_role_id uuid;
BEGIN
  -- Get the Administrador role ID
  SELECT id INTO v_admin_role_id
  FROM user_roles
  WHERE name = 'Administrador'
  LIMIT 1;

  -- Create auth user with encrypted password
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'lucasmonte@fesfsus.ba.gov.br',
    crypt('Testit123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Lucas Monte"}',
    false,
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  -- Create identity record with provider_id
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', 'lucasmonte@fesfsus.ba.gov.br'),
    'email',
    now(),
    now(),
    now()
  );

  -- Create system user record
  INSERT INTO system_users (
    id,
    email,
    full_name,
    role_id,
    active,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    'lucasmonte@fesfsus.ba.gov.br',
    'Lucas Monte',
    v_admin_role_id,
    true,
    now(),
    now()
  );

  RAISE NOTICE 'User created successfully with ID: %', v_user_id;
END $$;
