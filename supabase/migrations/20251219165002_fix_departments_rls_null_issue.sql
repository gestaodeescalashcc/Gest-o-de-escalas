/*
  # Corrigir Problema de Department NULL em JOINs

  ## Problema Identificado
  
  Quando usuários com roles Coordenador, Gestor ou Visualizador fazem queries que incluem JOIN com a tabela `departments`, o resultado do JOIN retorna NULL porque essas roles não têm a permissão `departments.read = true`.

  A política RLS atual de departments requer:
  ```
  USING (user_has_permission('departments', 'read'))
  ```

  Isso causa erro no frontend ao tentar acessar `shift.department.name` porque `department` é NULL.

  ## Solução Implementada

  1. **Adicionar política mais permissiva para SELECT em departments**
     - Permitir que TODOS os usuários autenticados possam VISUALIZAR departments
     - Departments não são informações sensíveis que precisam ser restritas
     - A segurança é mantida nas operações de escrita (INSERT/UPDATE/DELETE)

  2. **Manter as políticas restritivas para escrita**
     - CREATE, UPDATE e DELETE continuam requerendo permissões específicas
     - Apenas admins podem modificar departments

  3. **Atualizar permissões dos roles**
     - Adicionar `departments.read = true` aos roles Coordenador, Gestor e Visualizador
     - Isso garante consistência e previne problemas futuros

  ## Segurança
  - A visualização de departments não expõe dados sensíveis
  - As operações de modificação continuam protegidas
  - Esta abordagem segue o princípio de least privilege para escrita
*/

-- =====================================================
-- 1. ADICIONAR POLÍTICA PERMISSIVA PARA LEITURA DE DEPARTMENTS
-- =====================================================

-- Remove a política antiga que é muito restritiva
DROP POLICY IF EXISTS "Authorized users can view departments" ON departments;

-- Cria uma política mais permissiva: todos os usuários autenticados podem ver departments
CREATE POLICY "All authenticated users can view departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================
-- 2. ATUALIZAR PERMISSÕES DOS ROLES
-- =====================================================

-- Atualizar role Coordenador para incluir departments.read
UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{departments}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Coordenador';

-- Atualizar role Gestor para incluir departments.read
UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{departments}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Gestor';

-- Atualizar role Visualizador para incluir departments.read
UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{departments}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Visualizador';

-- =====================================================
-- 3. FAZER O MESMO PARA PROFESSIONAL_CATEGORIES
-- =====================================================

-- Categories também aparecem em JOINs e devem ser visíveis a todos
DROP POLICY IF EXISTS "Authorized users can view categories" ON professional_categories;

CREATE POLICY "All authenticated users can view categories"
  ON professional_categories FOR SELECT
  TO authenticated
  USING (true);

-- Atualizar permissões dos roles para categories
UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{professional_categories}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Coordenador';

UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{professional_categories}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Gestor';

UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{professional_categories}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Visualizador';

-- =====================================================
-- 4. COMPANIES TAMBÉM PRECISAM SER VISÍVEIS
-- =====================================================

-- Companies aparecem em JOINs com professionals
DROP POLICY IF EXISTS "Authorized users can view companies" ON companies;

CREATE POLICY "All authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- Atualizar permissões dos roles para companies
UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{companies}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Coordenador';

UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{companies}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Gestor';

UPDATE user_roles
SET permissions = jsonb_set(
  permissions,
  '{companies}',
  '{"read": true, "create": false, "update": false, "delete": false}'::jsonb,
  true
)
WHERE name = 'Visualizador';
