-- =============================================================================
-- Corrige o login da Camila Nossa (mesma rotina que funcionou pra Aline/Denif)
-- Senha temporária: MudarSenha@2026
-- =============================================================================

-- 1) Diagnóstico (cola o resultado se ainda não logar)
SELECT
  u.email,
  u.email_confirmed_at,
  u.encrypted_password IS NOT NULL AS tem_senha,
  u.aud, u.role,
  u.banned_until, u.deleted_at,
  u.confirmation_token, u.recovery_token,
  u.email_change_token_new, u.email_change,
  u.created_at
FROM auth.users u
WHERE u.email = 'camilanossa@fesfsus.ba.gov.br';

-- 2) Reseta senha + saneia tokens órfãos + confirma email
UPDATE auth.users
SET
  encrypted_password = crypt('MudarSenha@2026', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change = '',
  email_change_token_current = '',
  reauthentication_token = '',
  phone_change_token = '',
  aud = 'authenticated',
  role = 'authenticated',
  banned_until = NULL,
  deleted_at = NULL,
  updated_at = now()
WHERE email = 'camilanossa@fesfsus.ba.gov.br';

-- 3) Garante a entrada em auth.identities
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

-- 4) Verificação
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmado,
  u.encrypted_password IS NOT NULL AS tem_senha,
  EXISTS(SELECT 1 FROM auth.identities i
         WHERE i.user_id = u.id AND i.provider = 'email') AS tem_identity,
  CASE
    WHEN u.email_confirmed_at IS NOT NULL
     AND u.encrypted_password IS NOT NULL
     AND EXISTS(SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email')
    THEN '✓ pronta pra logar'
    ELSE '⚠ ainda inválido'
  END AS status
FROM auth.users u
WHERE u.email = 'camilanossa@fesfsus.ba.gov.br';
