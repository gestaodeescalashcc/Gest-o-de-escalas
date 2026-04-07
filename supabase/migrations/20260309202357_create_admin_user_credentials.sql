/*
  # Create Admin User

  Creates a new administrator user with full system access.

  1. New Auth User
    - Email: admin@sistema.com
    - Password: Admin@2025 (bcrypt hashed)
    - Email pre-confirmed

  2. System User Record
    - Linked to the Administrador role
    - Active status
    - No department restrictions (full access)
*/

DO $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  admin_role_id uuid;
BEGIN
  SELECT id INTO admin_role_id FROM user_roles WHERE name = 'Administrador' LIMIT 1;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@sistema.com') THEN
    RAISE NOTICE 'User admin@sistema.com already exists, skipping.';
    RETURN;
  END IF;

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
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@sistema.com',
    crypt('Admin@2025', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

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
    new_user_id,
    'admin@sistema.com',
    jsonb_build_object('sub', new_user_id::text, 'email', 'admin@sistema.com'),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  IF admin_role_id IS NOT NULL THEN
    INSERT INTO system_users (id, email, full_name, role_id, active, allowed_departments)
    VALUES (new_user_id, 'admin@sistema.com', 'Administrador do Sistema', admin_role_id, true, null)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Admin user created with id: %', new_user_id;
END $$;
