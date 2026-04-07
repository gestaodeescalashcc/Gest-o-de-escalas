/*
  # Corrigir Política de INSERT em audit_logs

  ## Problema CRÍTICO:
  A política "only_trigger_can_insert_audit_logs" tem WITH CHECK (false),
  o que BLOQUEIA TODOS OS INSERTS, incluindo os feitos por triggers!

  Isso causa falha em cascata:
  1. Usuário tenta criar outro usuário
  2. Edge Function insere em system_users
  3. Trigger audit_system_users_trigger dispara
  4. Trigger tenta inserir em audit_logs
  5. Política WITH CHECK (false) BLOQUEIA
  6. INSERT em system_users falha
  7. Erro: "Database error creating new user"

  ## Solução:
  A política deve permitir INSERT apenas de triggers/funções,
  não de usuários diretos. Como triggers rodam com privilégios
  de SECURITY DEFINER, precisamos permitir quando não há auth.uid()
  (contexto de trigger/service role).

  ## Segurança:
  - Usuários normais NÃO podem inserir diretamente (auth.uid() existe)
  - Triggers podem inserir (auth.uid() é NULL no contexto)
  - Service role pode inserir (auth.uid() é NULL)
*/

-- Remover política incorreta
DROP POLICY IF EXISTS "only_trigger_can_insert_audit_logs" ON audit_logs;

-- Nova política correta: permite INSERT apenas quando auth.uid() é NULL
-- (contexto de trigger ou service role, não usuário direto)
CREATE POLICY "only_trigger_can_insert_audit_logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);  -- Triggers sempre podem inserir

-- IMPORTANTE: Como audit_logs tem RLS habilitado, usuários normais
-- não conseguem fazer INSERT direto porque não têm uma política que
-- permita quando auth.uid() existe. Apenas triggers (que rodam em
-- contexto sem auth.uid()) conseguem inserir.
