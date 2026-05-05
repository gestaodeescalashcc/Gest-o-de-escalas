-- =============================================================================
-- CRIA AS DUAS COORDENADORAS DE ENFERMAGEM 100% VIA SQL
-- - Cria conta em auth.users (com senha temporária)
-- - Cria perfil em system_users espelhando Rafaela (role + setores)
--
-- ⚠ ATENÇÃO:
--  • Senha temporária: "MudarSenha@2026"   ← compartilhe com elas e peça
--                                            que troquem no 1º login.
--  • Rode no SQL Editor do Supabase (que executa como service_role e
--    consegue gravar em auth.users).
--  • Idempotente: se a conta já existir, só atualiza o system_users.
-- =============================================================================

-- 1) Cria as contas em auth.users (se ainda não existirem)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  email,
  crypt('MudarSenha@2026', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name),
  'authenticated',
  'authenticated',
  now(),
  now()
FROM (VALUES
  ('alinedsantos@fesfsus.ba.gov.br', 'Aline dos Santos'),
  ('denifsouza25@hotmail.com',       'Denif Souza')
) AS v(email, full_name)
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE auth.users.email = v.email
);

-- 2) Cria/atualiza o registro em system_users espelhando a Rafaela
INSERT INTO system_users (id, email, full_name, role_id, allowed_departments, active)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name',
    CASE u.email
      WHEN 'alinedsantos@fesfsus.ba.gov.br' THEN 'Aline dos Santos'
      WHEN 'denifsouza25@hotmail.com'      THEN 'Denif Souza'
    END
  ) AS full_name,
  rf.role_id,
  rf.allowed_departments,
  true
FROM auth.users u
CROSS JOIN (
  SELECT role_id, allowed_departments
  FROM system_users
  WHERE LOWER(full_name) LIKE '%rafaela%' AND active = true
  LIMIT 1
) rf
WHERE u.email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com')
ON CONFLICT (id) DO UPDATE
SET role_id             = EXCLUDED.role_id,
    allowed_departments = EXCLUDED.allowed_departments,
    full_name           = EXCLUDED.full_name,
    active              = true;

-- 3) Verificação — lista as 3 coordenadoras (Rafaela + 2 novas)
SELECT
  su.email,
  su.full_name,
  ur.name AS perfil,
  CASE
    WHEN su.allowed_departments IS NULL THEN 'TODOS'
    ELSE (
      SELECT string_agg(d.name, ', ' ORDER BY d.name)
      FROM departments d
      WHERE d.id = ANY(su.allowed_departments)
    )
  END AS setores_permitidos,
  su.active
FROM system_users su
JOIN user_roles ur ON ur.id = su.role_id
WHERE LOWER(su.full_name) LIKE '%rafaela%'
   OR su.email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com')
ORDER BY su.full_name;
