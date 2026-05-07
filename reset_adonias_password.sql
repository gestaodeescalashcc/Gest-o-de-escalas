-- =============================================================================
-- Reseta a senha do Adonias para "MudarSenha@2026"
-- Após logar, troque pelo painel de configurações.
-- =============================================================================

-- 1) Confere qual é o email exato do usuário
SELECT u.id, u.email, su.full_name, ur.name AS perfil
FROM auth.users u
LEFT JOIN system_users su ON su.id = u.id
LEFT JOIN user_roles ur ON ur.id = su.role_id
WHERE u.email ILIKE '%adonias%' OR su.full_name ILIKE '%adonias%';

-- 2) Reseta a senha (use o email retornado acima — ajuste se precisar)
UPDATE auth.users
SET
  encrypted_password = crypt('MudarSenha@2026', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  banned_until = NULL,
  deleted_at = NULL
WHERE email ILIKE '%adonias%';

-- 3) Garante que existe identidade pra login email/senha
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
WHERE u.email ILIKE '%adonias%'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'email'
  );

-- 4) Verificação final
SELECT
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmado,
  u.encrypted_password IS NOT NULL AS tem_senha,
  EXISTS(SELECT 1 FROM auth.identities i
         WHERE i.user_id = u.id AND i.provider = 'email') AS tem_identity
FROM auth.users u
WHERE u.email ILIKE '%adonias%';
