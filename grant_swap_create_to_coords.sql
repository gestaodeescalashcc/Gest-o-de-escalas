-- =============================================================================
-- Garante que Coordenador/Gestor podem CRIAR e LER trocas (shift_swaps).
--
-- O RLS de shift_swaps usa user_has_permission('schedules', X), então
-- precisamos garantir schedules.create / schedules.read / schedules.update.
-- =============================================================================

UPDATE user_roles
SET permissions =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(permissions, '{}'::jsonb),
            '{schedules,read}', 'true'::jsonb, true
          ),
          '{schedules,create}', 'true'::jsonb, true
        ),
        '{schedules,update}', 'true'::jsonb, true
      ),
      '{swaps,create}', 'true'::jsonb, true
    ),
    '{swaps,read}', 'true'::jsonb, true
  )
WHERE name IN ('Coordenador', 'Gestor');

-- Verificação
SELECT name, permissions->'schedules' AS schedules, permissions->'swaps' AS swaps
FROM user_roles
WHERE name IN ('Coordenador', 'Gestor')
ORDER BY name;
