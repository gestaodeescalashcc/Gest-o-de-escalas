-- =============================================================================
-- RECONCILIA TROCAS APROVADAS COM OS SHIFTS
--
-- Para toda troca em status 'Aprovado':
--   - shifts.original_shift_id deve estar com target_professional_id
--   - shifts.offered_shift_id  deve estar com requesting_professional_id
--
-- Se algum UPDATE foi bloqueado pelo RLS no momento da aprovação, esse SQL
-- aplica os ajustes em uma única transação (executando como service role
-- ou via SQL editor do Supabase, que ignora o RLS).
--
-- 1) PRIMEIRO: lista as inconsistências que serão corrigidas (preview)
-- =============================================================================

SELECT
  ss.id AS swap_id,
  ss.created_at,
  -- Original
  os.id AS original_shift_id,
  os.shift_date AS data_original,
  os.professional_id AS original_dono_atual,
  ss.target_professional_id AS original_deveria_ser,
  CASE WHEN os.professional_id <> ss.target_professional_id THEN 'PRECISA_CORRIGIR' ELSE 'ok' END AS check_original,
  -- Offered
  ofs.id AS offered_shift_id,
  ofs.shift_date AS data_oferecida,
  ofs.professional_id AS offered_dono_atual,
  ss.requesting_professional_id AS offered_deveria_ser,
  CASE
    WHEN ss.offered_shift_id IS NULL THEN 'sem_oferecido'
    WHEN ofs.professional_id <> ss.requesting_professional_id THEN 'PRECISA_CORRIGIR'
    ELSE 'ok'
  END AS check_offered
FROM shift_swaps ss
LEFT JOIN shifts os  ON os.id  = ss.original_shift_id
LEFT JOIN shifts ofs ON ofs.id = ss.offered_shift_id
WHERE ss.status = 'Aprovado'
ORDER BY ss.created_at DESC;

-- =============================================================================
-- 2) DEPOIS DE CONFERIR ACIMA, rode os UPDATEs abaixo (descomentando)
-- =============================================================================

-- Corrige original_shift: dono passa a ser o target_professional_id
-- UPDATE shifts s
-- SET professional_id = ss.target_professional_id
-- FROM shift_swaps ss
-- WHERE ss.status = 'Aprovado'
--   AND s.id = ss.original_shift_id
--   AND s.professional_id <> ss.target_professional_id;

-- Corrige offered_shift: dono passa a ser o requesting_professional_id
-- UPDATE shifts s
-- SET professional_id = ss.requesting_professional_id
-- FROM shift_swaps ss
-- WHERE ss.status = 'Aprovado'
--   AND ss.offered_shift_id IS NOT NULL
--   AND s.id = ss.offered_shift_id
--   AND s.professional_id <> ss.requesting_professional_id;
