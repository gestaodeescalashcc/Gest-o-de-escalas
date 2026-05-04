-- Lista todas as trocas pendentes para você revisar antes de aprovar manualmente
SELECT
  ss.id,
  ss.requested_at::date AS solicitado_em,
  os.shift_date AS data_plantao,
  os.shift_type,
  rp.full_name AS solicitante,
  tp.full_name AS destinatario,
  CASE WHEN ss.offered_shift_id IS NOT NULL THEN 'Recíproca' ELSE 'Cessão simples' END AS tipo,
  ss.reason
FROM shift_swaps ss
LEFT JOIN shifts os ON os.id = ss.original_shift_id
LEFT JOIN professionals rp ON rp.id = ss.requesting_professional_id
LEFT JOIN professionals tp ON tp.id = ss.target_professional_id
WHERE ss.status = 'Pendente'
ORDER BY ss.requested_at DESC;
