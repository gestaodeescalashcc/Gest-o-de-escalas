/*
  # Corrigir INSERT em system_users para Service Role

  ## Problema:
  A Edge Function create-user usa service_role_key para inserir em system_users,
  mas a política RLS está bloqueando porque tenta verificar user_has_permission()
  que depende de auth.uid() - que é NULL para service role.

  ## Solução:
  Adicionar política que permite INSERT quando auth.uid() IS NULL (service role)
  OU quando o usuário tem permissão 'users.create'.

  ## Segurança:
  - Service role só é acessível via Edge Functions seguras
  - Usuários normais continuam precisando de permissão
*/

-- Remover política antiga
DROP POLICY IF EXISTS "authorized_create_users" ON system_users;

-- Nova política que suporta service role E usuários autorizados
CREATE POLICY "authorized_create_users"
  ON system_users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Permite se for service role (auth.uid() é NULL)
    auth.uid() IS NULL
    OR
    -- OU se for usuário autenticado com permissão
    user_has_permission('users', 'create')
  );
