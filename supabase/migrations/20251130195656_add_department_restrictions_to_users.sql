/*
  # Adicionar Restrições de Departamento aos Usuários

  ## Visão Geral
  Esta migration adiciona a capacidade de restringir usuários a departamentos específicos,
  permitindo controle granular de acesso por setor.

  ## Alterações

  1. Adicionar campo `allowed_departments` à tabela `system_users`
     - Array de UUIDs dos departamentos permitidos
     - NULL = acesso a todos os departamentos
     - Array vazio = sem acesso a nenhum departamento
     - Array com IDs = acesso apenas aos departamentos listados

  ## Casos de Uso

  - **Administrador**: allowed_departments = NULL (acessa todos)
  - **Coordenador de Emergência**: allowed_departments = [id_emergencia] (só acessa Emergência)
  - **Gestor Multi-setorial**: allowed_departments = [id_uti, id_emergencia] (acessa UTI e Emergência)
  - **Visualizador Restrito**: allowed_departments = [id_enfermaria] (só visualiza Enfermaria)

  ## Segurança

  - Políticas RLS já existentes continuam funcionando
  - Validação adicional no nível da aplicação via hook usePermissions
  - Administradores sempre têm acesso total (ignoram restrições)
*/

-- Adicionar coluna allowed_departments à tabela system_users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'system_users' AND column_name = 'allowed_departments'
  ) THEN
    ALTER TABLE system_users 
    ADD COLUMN allowed_departments uuid[] DEFAULT NULL;
  END IF;
END $$;

-- Criar índice para performance em consultas por departamento
CREATE INDEX IF NOT EXISTS idx_system_users_allowed_departments 
ON system_users USING GIN (allowed_departments);

-- Adicionar comentário explicativo
COMMENT ON COLUMN system_users.allowed_departments IS 
'Array de IDs de departamentos aos quais o usuário tem acesso. NULL = todos os departamentos, [] = nenhum, [ids] = apenas os listados';
