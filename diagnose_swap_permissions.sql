-- =============================================================================
-- DIAGNÓSTICO: por que a troca da Rafaela não apareceu na lista?
-- =============================================================================

-- 1) Permissões dos perfis Coordenador / Gestor para shift_swaps
--    O RLS de shift_swaps usa user_has_permission('schedules', X)
SELECT
  ur.name AS perfil,
  ur.permissions->'schedules' AS schedules_permissions,
  ur.permissions->'swaps' AS swaps_permissions
FROM user_roles ur
WHERE ur.name IN ('Coordenador', 'Gestor', 'Administrador')
ORDER BY ur.name;

-- 2) Trocas registradas nas últimas 24h (vê se a troca da Rafaela está lá)
SELECT
  ss.id,
  ss.created_at,
  ss.status,
  rp.full_name AS solicitante,
  tp.full_name AS destinatario,
  os.shift_date AS data_original,
  os.id AS original_shift_id,
  ofs.shift_date AS data_oferecida,
  ss.approved_by,
  approver.full_name AS aprovado_por
FROM shift_swaps ss
LEFT JOIN professionals rp ON rp.id = ss.requesting_professional_id
LEFT JOIN professionals tp ON tp.id = ss.target_professional_id
LEFT JOIN shifts os ON os.id = ss.original_shift_id
LEFT JOIN shifts ofs ON ofs.id = ss.offered_shift_id
LEFT JOIN system_users approver ON approver.id = ss.approved_by
WHERE ss.created_at > now() - interval '24 hours'
ORDER BY ss.created_at DESC;

-- 3) Total de trocas por status (visão geral)
SELECT status, COUNT(*) FROM shift_swaps GROUP BY status ORDER BY status;
