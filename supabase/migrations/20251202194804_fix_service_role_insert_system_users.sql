/*
  # Corrigir INSERT em system_users para Service Role

  ## Problema Identificado:
  O erro "Database error creating new user" ocorre porque:
  1. A Edge Function usa `service_role_key` (cliente admin) para inserir em system_users
  2. As políticas RLS usam `TO authenticated` que NÃO se aplica ao service_role
  3. Quando service_role tenta inserir, a política não está ativa (não é "authenticated")
  4. RLS está habilitado, mas sem política aplicável = BLOQUEIO
  
  ## Solução:
  Mudar a política de INSERT para usar `TO service_role, authenticated`
  Isso permite que tanto service_role (Edge Functions) quanto usuários autenticados
  possam inserir, desde que atendam a condição WITH CHECK.

  ## Segurança:
  - Service role só é acessível via Edge Functions (servidor seguro)
  - A condição WITH CHECK continua validando permissões para usuários normais
  - auth.uid() IS NULL identifica chamadas de service_role
*/

-- 1. Remover política antiga que estava bloqueando
DROP POLICY IF EXISTS "Authorized users can create users" ON system_users;
DROP POLICY IF EXISTS "authorized_create_users" ON system_users;

-- 2. Criar nova política que funciona com service_role
CREATE POLICY "service_role_and_authorized_can_create_users"
  ON system_users FOR INSERT
  TO service_role, authenticated
  WITH CHECK (
    -- Permite se for service role (chamada de Edge Function)
    auth.uid() IS NULL
    OR
    -- OU se for usuário autenticado com permissão users.create
    (
      auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM system_users su
        JOIN user_roles ur ON su.role_id = ur.id
        WHERE su.id = auth.uid()
        AND su.active = true
        AND (ur.permissions->'users'->>'create')::boolean = true
      )
    )
  );

-- 3. Garantir que outras operações também funcionem com service_role se necessário
-- (As políticas de SELECT já funcionam, pois geralmente não bloqueiam service_role)

-- Nota: service_role tem bypass de RLS por padrão, MAS quando você usa um client
-- com service_role_key E especifica auth headers, ele respeita RLS.
-- Por isso precisamos da política explícita.
