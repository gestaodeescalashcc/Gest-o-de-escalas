-- Cria contas auth para todos os médicos ativos com login por CPF.
-- Email sintético: {cpf}@medico.medscale.local
-- Senha padrão: medico@2026 (trocar no primeiro acesso)
--
-- O LoginForm detecta input de 11 dígitos e converte automaticamente para esse
-- email antes de chamar supabase.auth.signInWithPassword. Outros usuários
-- (admin, diretoria, coordenadores) continuam usando email normalmente.
DO $$
DECLARE
  v_med record;
  v_user_id uuid;
  v_role_id uuid;
  v_allowed uuid[];
  v_email text;
  v_created int := 0;
  v_skipped int := 0;
BEGIN
  SELECT id INTO v_role_id FROM user_roles WHERE name = 'Médico' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Role "Médico" não encontrada';
  END IF;

  SELECT array_agg(id) INTO v_allowed FROM departments
  WHERE name IN ('Plantonistas','Diaristas','Interconsultores');

  FOR v_med IN
    SELECT p.id, p.full_name, regexp_replace(p.cpf, '\D', '', 'g') AS cpf_digits
    FROM professionals p
    JOIN professional_categories pc ON pc.id = p.category_id
    WHERE pc.name ILIKE '%médic%'
      AND p.active = true
      AND p.cpf IS NOT NULL
      AND length(regexp_replace(p.cpf, '\D', '', 'g')) = 11
      AND p.user_id IS NULL
  LOOP
    v_email := v_med.cpf_digits || '@medico.medscale.local';

    IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token,
      raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id, 'authenticated', 'authenticated', v_email,
      crypt('medico@2026', gen_salt('bf')),
      now(), now(), now(),
      '', '', '', '',
      jsonb_build_object('cpf', v_med.cpf_digits, 'full_name', v_med.full_name)
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id, v_email,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', now(), now(), now()
    );

    INSERT INTO system_users (id, email, full_name, role_id, active, allowed_departments, created_at, updated_at)
    VALUES (v_user_id, v_email, v_med.full_name, v_role_id, true, v_allowed, now(), now());

    UPDATE professionals SET user_id = v_user_id, updated_at = now() WHERE id = v_med.id;

    v_created := v_created + 1;
  END LOOP;

  RAISE NOTICE 'Médicos: % conta(s) criada(s), % pulada(s).', v_created, v_skipped;
END $$;
