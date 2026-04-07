/*
  # Desabilitar Trigger Automático de Registro de Usuários

  1. Problema
    - Existe um trigger `on_auth_user_created` que tenta inserir automaticamente em system_users
    - Isso conflita com a Edge Function create-user que também insere em system_users
    - O trigger usa um role_id padrão, mas queremos que o admin escolha o role
    - Causa race condition e erros de duplicação

  2. Solução
    - Desabilitar o trigger on_auth_user_created
    - Deixar apenas a Edge Function gerenciar a criação em system_users
    - Isso dá controle total ao administrador sobre o role do novo usuário

  3. Impacto
    - Usuários criados via Edge Function: ✅ Funcionará perfeitamente
    - Registro automático: ❌ Não funcionará mais (mas não é usado no sistema atual)
    - Controle total sobre roles: ✅ Admin escolhe o role correto
*/

-- Remover trigger que causa conflito
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remover a função associada (opcional, caso queira reativar depois)
-- Vamos manter a função mas desabilitar o trigger
-- DROP FUNCTION IF EXISTS handle_new_user();
