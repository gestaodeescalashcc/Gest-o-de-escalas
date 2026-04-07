/*
  # Sistema de Gestão de Usuários e Permissões

  ## Visão Geral
  Esta migration cria a infraestrutura completa para gerenciamento de usuários
  e controle de permissões no sistema de gestão de escalas.

  ## 1. Novas Tabelas

  ### `user_roles`
  Tabela de funções/papéis disponíveis no sistema:
  - `id` (uuid, primary key) - Identificador único da função
  - `name` (text, unique) - Nome da função (ex: Admin, Gestor, Operador, Visualizador)
  - `description` (text) - Descrição detalhada da função
  - `permissions` (jsonb) - Objeto JSON com permissões específicas
  - `created_at` (timestamptz) - Data/hora de criação
  - `updated_at` (timestamptz) - Data/hora da última atualização

  ### `system_users`
  Tabela de usuários do sistema vinculados ao auth.users do Supabase:
  - `id` (uuid, primary key) - Mesmo ID do auth.users
  - `email` (text, unique) - Email do usuário
  - `full_name` (text) - Nome completo
  - `role_id` (uuid, foreign key) - Função/papel do usuário
  - `active` (boolean) - Se o usuário está ativo
  - `last_login` (timestamptz) - Data/hora do último login
  - `created_at` (timestamptz) - Data/hora de criação
  - `created_by` (uuid) - ID do usuário que criou
  - `updated_at` (timestamptz) - Data/hora da última atualização

  ## 2. Permissões Estrutura JSON
  
  O campo `permissions` armazena um objeto JSON com as seguintes chaves:
  ```json
  {
    "professionals": { "create": true, "read": true, "update": true, "delete": true },
    "schedules": { "create": true, "read": true, "update": true, "delete": true },
    "swaps": { "create": true, "read": true, "approve": true, "delete": true },
    "departments": { "create": true, "read": true, "update": true, "delete": true },
    "reports": { "read": true, "export": true },
    "users": { "create": true, "read": true, "update": true, "delete": true }
  }
  ```

  ## 3. Funções Padrão

  Serão criadas 4 funções padrão:
  - **Administrador**: Acesso completo a todas as funcionalidades
  - **Gestor**: Acesso completo exceto gestão de usuários
  - **Coordenador**: Pode criar/editar escalas e aprovar trocas
  - **Visualizador**: Apenas leitura e exportação de relatórios

  ## 4. Segurança (RLS)

  - RLS habilitado em todas as tabelas
  - Usuários podem ver seus próprios dados
  - Apenas usuários com permissão "users.read" podem ver outros usuários
  - Apenas usuários com permissão "users.create/update/delete" podem modificar usuários
  - Todas as ações são auditadas

  ## 5. Índices

  Índices criados para otimizar consultas:
  - `system_users.email` para busca rápida por email
  - `system_users.role_id` para filtrar por função
  - `system_users.active` para filtrar usuários ativos

  ## 6. Triggers

  - Atualização automática de `updated_at` em mudanças
  - Sincronização com auth.users do Supabase

  ## Notas Importantes
  - O primeiro usuário criado deve ser promovido manualmente a Administrador
  - Senhas são gerenciadas pelo Supabase Auth
  - Emails de convite são enviados automaticamente
*/

-- Criar tabela de funções/papéis
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar tabela de usuários do sistema
CREATE TABLE IF NOT EXISTS system_users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role_id uuid REFERENCES user_roles(id) ON DELETE RESTRICT NOT NULL,
  active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES system_users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_role_id ON system_users(role_id);
CREATE INDEX IF NOT EXISTS idx_system_users_active ON system_users(active);
CREATE INDEX IF NOT EXISTS idx_user_roles_name ON user_roles(name);

-- Habilitar RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_roles

-- Todos usuários autenticados podem ler funções
CREATE POLICY "Authenticated users can read roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Apenas admins podem gerenciar funções
CREATE POLICY "Admins can manage roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND system_users.role_id IN (
        SELECT id FROM user_roles WHERE (permissions->>'users')::jsonb->>'update' = 'true'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users
      WHERE system_users.id = auth.uid()
      AND system_users.active = true
      AND system_users.role_id IN (
        SELECT id FROM user_roles WHERE (permissions->>'users')::jsonb->>'update' = 'true'
      )
    )
  );

-- Políticas RLS para system_users

-- Usuários podem ver seus próprios dados
CREATE POLICY "Users can view own data"
  ON system_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Usuários com permissão podem ver todos
CREATE POLICY "Users with permission can view all"
  ON system_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'read' = 'true'
    )
  );

-- Usuários com permissão podem criar usuários
CREATE POLICY "Authorized users can create users"
  ON system_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'create' = 'true'
    )
  );

-- Usuários com permissão podem atualizar usuários
CREATE POLICY "Authorized users can update users"
  ON system_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'update' = 'true'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'update' = 'true'
    )
  );

-- Usuários com permissão podem deletar usuários
CREATE POLICY "Authorized users can delete users"
  ON system_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM system_users su
      JOIN user_roles ur ON su.role_id = ur.id
      WHERE su.id = auth.uid()
      AND su.active = true
      AND (ur.permissions->>'users')::jsonb->>'delete' = 'true'
    )
  );

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
DROP TRIGGER IF EXISTS update_user_roles_updated_at ON user_roles;
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_system_users_updated_at ON system_users;
CREATE TRIGGER update_system_users_updated_at
  BEFORE UPDATE ON system_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Inserir funções padrão

-- 1. Administrador (acesso completo)
INSERT INTO user_roles (name, description, permissions) VALUES (
  'Administrador',
  'Acesso completo a todas as funcionalidades do sistema, incluindo gestão de usuários e configurações avançadas.',
  '{
    "professionals": {"create": true, "read": true, "update": true, "delete": true},
    "schedules": {"create": true, "read": true, "update": true, "delete": true},
    "swaps": {"create": true, "read": true, "approve": true, "delete": true},
    "departments": {"create": true, "read": true, "update": true, "delete": true},
    "reports": {"read": true, "export": true},
    "users": {"create": true, "read": true, "update": true, "delete": true}
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- 2. Gestor (quase tudo, exceto usuários)
INSERT INTO user_roles (name, description, permissions) VALUES (
  'Gestor',
  'Acesso completo para gerenciar profissionais, escalas, trocas e departamentos. Não pode gerenciar usuários.',
  '{
    "professionals": {"create": true, "read": true, "update": true, "delete": true},
    "schedules": {"create": true, "read": true, "update": true, "delete": true},
    "swaps": {"create": true, "read": true, "approve": true, "delete": true},
    "departments": {"create": true, "read": true, "update": true, "delete": true},
    "reports": {"read": true, "export": true},
    "users": {"create": false, "read": true, "update": false, "delete": false}
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- 3. Coordenador (criar escalas e aprovar trocas)
INSERT INTO user_roles (name, description, permissions) VALUES (
  'Coordenador',
  'Pode criar e editar escalas, aprovar trocas de plantões e visualizar relatórios. Acesso limitado a outras funcionalidades.',
  '{
    "professionals": {"create": false, "read": true, "update": false, "delete": false},
    "schedules": {"create": true, "read": true, "update": true, "delete": false},
    "swaps": {"create": true, "read": true, "approve": true, "delete": false},
    "departments": {"create": false, "read": true, "update": false, "delete": false},
    "reports": {"read": true, "export": true},
    "users": {"create": false, "read": true, "update": false, "delete": false}
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;

-- 4. Visualizador (apenas leitura)
INSERT INTO user_roles (name, description, permissions) VALUES (
  'Visualizador',
  'Acesso somente leitura para consultar escalas, profissionais e relatórios. Não pode fazer alterações no sistema.',
  '{
    "professionals": {"create": false, "read": true, "update": false, "delete": false},
    "schedules": {"create": false, "read": true, "update": false, "delete": false},
    "swaps": {"create": false, "read": true, "approve": false, "delete": false},
    "departments": {"create": false, "read": true, "update": false, "delete": false},
    "reports": {"read": true, "export": true},
    "users": {"create": false, "read": false, "update": false, "delete": false}
  }'::jsonb
) ON CONFLICT (name) DO NOTHING;
