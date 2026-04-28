/*
  # Create Coordinator Users

  Creates 6 new coordinator users for HECC departments.

  All users:
    - Role: Coordenador
    - Password: Hecc2026! (bcrypt hashed)
    - Email pre-confirmed
    - Active status
    - No department restrictions initially

  Users:
    1. Ana Rafaela Meneses Farini (anafarini@fesfsus.ba.gov.br)
    2. Care Caroline Santos Soares (caresoares@fesfsus.ba.gov.br)
    3. Deivson Nunes Ventura (deivsonventura@fesfsus.ba.gov.br)
    4. Lais Cardoso dos Anjos (laisestrela@fesfsus.ba.gov.br)
    5. Milena Borges Pereira (Milenapereira@fesfsus.ba.gov.br)
    6. Sandra Regines Paixao dos Reis (Sandraregines@fesfsus.ba.gov.br)
*/

DO $$
DECLARE
  coord_role_id uuid;
  new_user_id uuid;
  user_record RECORD;
BEGIN
  -- Get the Coordenador role ID
  SELECT id INTO coord_role_id FROM user_roles WHERE name = 'Coordenador' LIMIT 1;

  IF coord_role_id IS NULL THEN
    RAISE EXCEPTION 'Role Coordenador not found. Please ensure user_roles table has been seeded.';
  END IF;

  -- Loop through each coordinator to create
  FOR user_record IN (
    SELECT *
    FROM (VALUES
      ('anafarini@fesfsus.ba.gov.br',    'Ana Rafaela Meneses Farini'),
      ('caresoares@fesfsus.ba.gov.br',    'Care Caroline Santos Soares'),
      ('deivsonventura@fesfsus.ba.gov.br','Deivson Nunes Ventura'),
      ('laisestrela@fesfsus.ba.gov.br',   'Lais Cardoso dos Anjos'),
      ('Milenapereira@fesfsus.ba.gov.br', 'Milena Borges Pereira'),
      ('Sandraregines@fesfsus.ba.gov.br', 'Sandra Regines Paixao dos Reis')
    ) AS t(email, full_name)
  ) LOOP
    -- Skip if user already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = user_record.email) THEN
      RAISE NOTICE 'User % already exists, skipping.', user_record.email;
      CONTINUE;
    END IF;

    new_user_id := gen_random_uuid();

    -- Create auth user
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
      user_record.email,
      crypt('Hecc2026!', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );

    -- Create auth identity
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
      user_record.email,
      jsonb_build_object('sub', new_user_id::text, 'email', user_record.email),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    -- Create system user linked to Coordenador role
    INSERT INTO system_users (id, email, full_name, role_id, active, allowed_departments)
    VALUES (new_user_id, user_record.email, user_record.full_name, coord_role_id, true, null)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Coordinator created: % (%)', user_record.full_name, user_record.email;
  END LOOP;

  RAISE NOTICE 'All coordinator users processed successfully.';
END $$;
