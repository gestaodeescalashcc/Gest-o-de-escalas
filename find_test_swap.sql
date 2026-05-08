-- Lista TODAS as trocas aprovadas (recentes primeiro)
SELECT
  ss.id,
  ss.created_at,
  ss.status,
  rp.full_name AS solicitante,
  tp.full_name AS destinatario,
  os.shift_date AS data_original,
  os.id AS original_shift_id,
  os.shift_type AS turno_original,
  ofs.shift_date AS data_oferecida,
  ofs.id AS offered_shift_id,
  ofs.shift_type AS turno_oferecido,
  ss.reason
FROM shift_swaps ss
LEFT JOIN professionals rp ON rp.id = ss.requesting_professional_id
LEFT JOIN professionals tp ON tp.id = ss.target_professional_id
LEFT JOIN shifts os ON os.id = ss.original_shift_id
LEFT JOIN shifts ofs ON ofs.id = ss.offered_shift_id
ORDER BY ss.created_at DESC
LIMIT 20;
