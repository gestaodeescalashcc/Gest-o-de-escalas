/*
  # Simplificar Política de INSERT para system_users

  1. Problema
    - Política atual é muito complexa e pode causar problemas
    - Service role deve sempre poder inserir sem verificações

  2. Solução
    - Remover política antiga complexa
    - Criar política nova e mais simples
    - Service role sempre pode inserir
    - Usuários autenticados precisam de permissão

  3. Segurança
    - RLS continua habilitado
    - Service role tem acesso total (correto para Edge Functions)
    - Usuários comuns precisam de permissão users.create
*/

-- Remover política antiga
DROP POLICY IF EXISTS "service_role_and_authorized_can_create_users" ON system_users;

-- Criar política simplificada
CREATE POLICY "service_role_can_insert"
  ON system_users FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "authorized_users_can_insert"
  ON system_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
        AND su.active = true
        AND ((ur.permissions->'users'->>'create')::boolean = true)
    )
  );