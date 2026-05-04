-- =============================================================================
-- DAR PERMISSÃO DE UPDATE/DELETE EM SWAPS PARA COORDENADOR E GESTOR
--
-- Motivo: Coordenadores precisam APROVAR/RECUSAR trocas de plantão.
-- A política RLS em shift_swaps verifica user_has_permission('swaps','update')
-- mas a role Coordenador só tinha {create, read, approve, delete=false}.
-- Sem 'update', o UPDATE de status='Aprovado' falha SILENCIOSAMENTE
-- (retorna sucesso com 0 linhas afetadas).
-- =============================================================================

UPDATE user_roles
SET permissions = jsonb_set(
  jsonb_set(permissions, '{swaps,update}', 'true'::jsonb, true),
  '{swaps,delete}', 'true'::jsonb, true
)
WHERE name IN ('Coordenador', 'Gestor');

-- Verificação
SELECT
  name,
  (permissions -> 'swaps') AS swaps_perms
FROM user_roles
WHERE name IN ('Administrador', 'Gestor', 'Coordenador', 'Visualizador')
ORDER BY name;
