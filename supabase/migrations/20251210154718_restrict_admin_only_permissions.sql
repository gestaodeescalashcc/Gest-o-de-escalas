/*
  # Restringir Permissões Exclusivas para Administradores

  1. Problema
    - Atualmente, Gestor e Coordenador têm permissão para visualizar Usuários, Setores, Categorias e Empresas
    - O requisito é que APENAS Administradores possam acessar esses módulos

  2. Solução
    - Remover permissões de leitura de departments, categories, companies e users dos perfis:
      - Gestor
      - Coordenador
      - Visualizador
    - Apenas Administrador manterá essas permissões

  3. Módulos Restritos a Admin
    - ✅ Usuários (users)
    - ✅ Setores (departments)
    - ✅ Categorias (professional_categories)
    - ✅ Empresas (companies)
    - ✅ Histórico (audit_logs - via schedules read)
*/

-- Atualizar permissões do Gestor
UPDATE user_roles
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        permissions,
        '{users}',
        '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
      ),
      '{departments}',
      '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
    ),
    '{professional_categories}',
    '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
  ),
  '{companies}',
  '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
)
WHERE name = 'Gestor';

-- Atualizar permissões do Coordenador
UPDATE user_roles
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        permissions,
        '{users}',
        '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
      ),
      '{departments}',
      '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
    ),
    '{professional_categories}',
    '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
  ),
  '{companies}',
  '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
)
WHERE name = 'Coordenador';

-- Atualizar permissões do Visualizador (já tem users=false, mas garantir departments, categories e companies)
UPDATE user_roles
SET permissions = jsonb_set(
  jsonb_set(
    jsonb_set(
      permissions,
      '{departments}',
      '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
    ),
    '{professional_categories}',
    '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
  ),
  '{companies}',
  '{"read": false, "create": false, "update": false, "delete": false}'::jsonb
)
WHERE name = 'Visualizador';
