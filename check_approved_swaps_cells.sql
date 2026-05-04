-- =============================================================================
-- Mostra TODAS as trocas aprovadas e a qual célula (profissional + data)
-- elas devem corresponder na escala consolidada.
--
-- Use isso para conferir se o destaque verde está aparecendo nas células certas.
-- =============================================================================

SELECT
  ss.id,
  ss.created_at,
  ss.status,
  -- Plantão original: agora está com o destinatário
  os.shift_date AS data_original,
  tp.full_name  AS celula_original_dono,
  -- Plantão oferecido: agora está com o solicitante
  ofs.shift_date AS data_oferecida,
  rp.full_name   AS celula_oferecida_dono,
  -- Quem cedeu/recebeu
  rp.full_name AS solicitante,
  tp.full_name AS destinatario
FROM shift_swaps ss
LEFT JOIN shifts os         ON os.id = ss.original_shift_id
LEFT JOIN shifts ofs        ON ofs.id = ss.offered_shift_id
LEFT JOIN professionals rp  ON rp.id  = ss.requesting_professional_id
LEFT JOIN professionals tp  ON tp.id  = ss.target_professional_id
WHERE ss.status = 'Aprovado'
ORDER BY ss.created_at DESC;

-- Verifica se os shifts ainda existem (caso tenham sido apagados, a marcação não aparece)
SELECT
  ss.id AS swap_id,
  ss.original_shift_id,
  ss.offered_shift_id,
  CASE WHEN os.id IS NULL THEN 'FALTANDO' ELSE 'ok' END  AS status_original,
  CASE WHEN ofs.id IS NULL AND ss.offered_shift_id IS NOT NULL THEN 'FALTANDO'
       WHEN ss.offered_shift_id IS NULL THEN 'sem_oferecido'
       ELSE 'ok' END AS status_oferecido
FROM shift_swaps ss
LEFT JOIN shifts os  ON os.id = ss.original_shift_id
LEFT JOIN shifts ofs ON ofs.id = ss.offered_shift_id
WHERE ss.status = 'Aprovado';

-- Confirma que após a troca o shift está com o destinatário (cessão simples ou recíproca)
SELECT
  ss.id AS swap_id,
  os.shift_date,
  s_now.professional_id AS dono_atual_no_shift,
  ss.target_professional_id AS deveria_estar_com,
  CASE WHEN s_now.professional_id = ss.target_professional_id THEN 'OK' ELSE 'INCONSISTENTE' END AS check
FROM shift_swaps ss
JOIN shifts s_now ON s_now.id = ss.original_shift_id
JOIN shifts os    ON os.id = ss.original_shift_id
WHERE ss.status = 'Aprovado';
