-- =============================================================================
-- DIAGNÓSTICO + CORREÇÃO de login das coordenadoras
--
-- Sintoma: usuárias criadas via SQL não conseguem entrar.
-- Causa mais comum: falta entrada em auth.identities (obrigatória
-- para autenticação por email/senha em versões recentes do Supabase).
-- =============================================================================

-- ====================
-- PARTE 1 — diagnóstico
-- ====================

-- 1.1 Confere campos críticos das contas criadas
SELECT
  u.email,
  u.id,
  u.email_confirmed_at,
  u.encrypted_password IS NOT NULL AS tem_senha,
  u.aud,
  u.role,
  u.banned_until,
  u.deleted_at,
  u.confirmation_token,
  u.recovery_token,
  u.created_at
FROM auth.users u
WHERE u.email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com');

-- 1.2 Verifica se existe identidade em auth.identities
SELECT
  u.email,
  i.id AS identity_id,
  i.provider,
  i.provider_id,
  CASE WHEN i.id IS NULL THEN '⚠ FALTA AUTH.IDENTITIES' ELSE 'ok' END AS status
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
WHERE u.email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com');

-- ====================
-- PARTE 2 — correção
-- ====================

-- 2.1 Garante senha criptografada e email confirmado
UPDATE auth.users
SET
  encrypted_password = crypt('MudarSenha@2026', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change = '',
  aud = 'authenticated',
  role = 'authenticated',
  banned_until = NULL,
  deleted_at = NULL,
  updated_at = now()
WHERE email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com');

-- 2.2 Cria a entrada em auth.identities (necessária para login email/senha)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com')
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- 2.3 Verificação final — login deve funcionar agora
SELECT
  u.email,
  u.email_confirmed_at,
  u.encrypted_password IS NOT NULL AS tem_senha,
  COUNT(i.id) AS qtd_identities_email,
  CASE
    WHEN u.email_confirmed_at IS NOT NULL
     AND u.encrypted_password IS NOT NULL
     AND COUNT(i.id) > 0
    THEN '✓ pronto pra logar'
    ELSE '⚠ ainda inválido'
  END AS status
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id AND i.provider = 'email'
WHERE u.email IN ('alinedsantos@fesfsus.ba.gov.br', 'denifsouza25@hotmail.com')
GROUP BY u.id, u.email, u.email_confirmed_at, u.encrypted_password;
