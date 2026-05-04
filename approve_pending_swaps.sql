-- =============================================================================
-- APROVAR TROCAS PENDENTES MANUALMENTE
--
-- ⚠️ ATENÇÃO: este SQL apenas atualiza o STATUS em shift_swaps.
-- NÃO faz UPDATE nos shifts (porque presumivelmente o handleApprove anterior
-- já aplicou as mudanças nos shifts antes do RLS bloquear o status).
--
-- Use isso só se você verificou que:
-- - As trocas estão como 'Pendente' em shift_swaps
-- - Os shifts JÁ foram atualizados (professionals trocados nas células)
-- =============================================================================

-- OPÇÃO A: Aprovar TODAS as trocas pendentes
UPDATE shift_swaps
SET
  status = 'Aprovado',
  responded_at = now(),
  approved_at = now(),
  approved_by = (
    SELECT id FROM system_users
    WHERE role_id = (SELECT id FROM user_roles WHERE name = 'Administrador' LIMIT 1)
    AND active = true
    ORDER BY created_at LIMIT 1
  )
WHERE status = 'Pendente';

-- OPÇÃO B (alternativa): Aprovar apenas IDs específicos
-- Substitua 'id-aqui' pelos IDs retornados na list_pending_swaps.sql
-- UPDATE shift_swaps
-- SET status = 'Aprovado', responded_at = now(), approved_at = now(),
--     approved_by = (SELECT id FROM system_users WHERE role_id = (SELECT id FROM user_roles WHERE name = 'Administrador' LIMIT 1) AND active = true ORDER BY created_at LIMIT 1)
-- WHERE id IN ('id-1', 'id-2');

-- Verificação
SELECT
  status,
  COUNT(*) AS qtd
FROM shift_swaps
GROUP BY status
ORDER BY status;
