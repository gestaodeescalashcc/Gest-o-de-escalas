-- =============================================================================
-- Cadastra Camila Nossa como Coordenadora de Fisioterapia
-- - Cria conta em auth.users (senha temporária: MudarSenha@2026)
-- - Cria entrada em auth.identities (necessária para login email/senha)
-- - Cria perfil em system_users com role Coordenador limitado ao setor Fisioterapia
-- Idempotente: se a conta já existir, apenas atualiza o system_users.
-- =============================================================================

-- 1) Cria conta em auth.users (se não existir)
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'camilanossa@fesfsus.ba.gov.br',
  crypt('MudarSenha@2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'Camila Nossa'),
  'authenticated', 'authenticated',
  now(), now(),
  '', '', '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'camilanossa@fesfsus.ba.gov.br'
);

-- 2) Cria identidade pra login email/senha (se não existir)
INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
FROM auth.users u
WHERE u.email = 'camilanossa@fesfsus.ba.gov.br'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- 3) Cria/atualiza perfil em system_users — Coordenadora limitada ao setor Fisioterapia
INSERT INTO system_users (id, email, full_name, role_id, allowed_departments, active)
SELECT
  u.id,
  u.email,
  'Camila Nossa',
  (SELECT id FROM user_roles WHERE name = 'Coordenador' LIMIT 1),
  ARRAY['3b1347db-ffde-4d86-8c4a-c99eecc52ed0']::uuid[],
  true
FROM auth.users u
WHERE u.email = 'camilanossa@fesfsus.ba.gov.br'
ON CONFLICT (id) DO UPDATE
SET role_id             = EXCLUDED.role_id,
    allowed_departments = EXCLUDED.allowed_departments,
    full_name           = EXCLUDED.full_name,
    active              = true,
    email               = EXCLUDED.email;

-- 4) Verificação
SELECT
  su.email,
  su.full_name,
  ur.name AS perfil,
  (SELECT string_agg(d.name, ', ')
   FROM departments d WHERE d.id = ANY(su.allowed_departments)) AS setores,
  su.active,
  EXISTS(SELECT 1 FROM auth.identities i
         WHERE i.user_id = su.id AND i.provider = 'email') AS tem_identity
FROM system_users su
JOIN user_roles ur ON ur.id = su.role_id
WHERE su.email = 'camilanossa@fesfsus.ba.gov.br';
