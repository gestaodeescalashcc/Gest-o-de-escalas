-- Garante que Coordenador / Gestor podem excluir escalas
UPDATE user_roles
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{schedules,delete}', 'true'::jsonb, true
)
WHERE name IN ('Coordenador', 'Gestor');

-- Verificação
SELECT name, permissions->'schedules' AS schedules
FROM user_roles
WHERE name IN ('Coordenador', 'Gestor', 'Administrador')
ORDER BY name;
