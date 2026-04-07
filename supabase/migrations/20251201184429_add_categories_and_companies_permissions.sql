/*
  # Adicionar Permissões para Categorias e Empresas

  1. Alterações
    - Atualiza as permissões de todas as roles existentes
    - Adiciona permissões para `professional_categories` (criar, ler, atualizar, deletar)
    - Adiciona permissões para `companies` (criar, ler, atualizar, deletar)

  2. Estrutura das Novas Permissões
    ```json
    {
      "professional_categories": {
        "create": true/false,
        "read": true/false,
        "update": true/false,
        "delete": true/false
      },
      "companies": {
        "create": true/false,
        "read": true/false,
        "update": true/false,
        "delete": true/false
      }
    }
    ```

  3. Permissões por Role
    - **Administrador**: Acesso completo (create, read, update, delete) para ambos
    - **Gestor**: Acesso completo (create, read, update, delete) para ambos
    - **Coordenador**: Apenas leitura (read) para ambos
    - **Visualizador**: Apenas leitura (read) para ambos

  ## Notas Importantes
  - Esta migration atualiza as roles existentes sem perder as permissões atuais
  - Usa jsonb_set para adicionar as novas chaves mantendo as existentes
*/

-- Atualizar Administrador - Acesso completo
UPDATE user_roles
SET permissions = permissions || 
  '{
    "professional_categories": {"create": true, "read": true, "update": true, "delete": true},
    "companies": {"create": true, "read": true, "update": true, "delete": true}
  }'::jsonb
WHERE name = 'Administrador';

-- Atualizar Gestor - Acesso completo
UPDATE user_roles
SET permissions = permissions || 
  '{
    "professional_categories": {"create": true, "read": true, "update": true, "delete": true},
    "companies": {"create": true, "read": true, "update": true, "delete": true}
  }'::jsonb
WHERE name = 'Gestor';

-- Atualizar Coordenador - Apenas leitura
UPDATE user_roles
SET permissions = permissions || 
  '{
    "professional_categories": {"create": false, "read": true, "update": false, "delete": false},
    "companies": {"create": false, "read": true, "update": false, "delete": false}
  }'::jsonb
WHERE name = 'Coordenador';

-- Atualizar Visualizador - Apenas leitura
UPDATE user_roles
SET permissions = permissions || 
  '{
    "professional_categories": {"create": false, "read": true, "update": false, "delete": false},
    "companies": {"create": false, "read": true, "update": false, "delete": false}
  }'::jsonb
WHERE name = 'Visualizador';
