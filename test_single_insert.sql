-- Teste manual: insere UM shift pra ver se passa
-- Substitua o nome do profissional e a escala se precisar

INSERT INTO shifts (
  professional_id, schedule_id, department_id,
  shift_date, shift_type, start_time, end_time
)
SELECT
  p.id,
  ms.id,
  ms.department_id,
  '2026-05-01'::date,
  'P',
  '07:00'::time,
  '07:00'::time
FROM professionals p, monthly_schedules ms
WHERE p.full_name ILIKE '%LUCIN%ANDRADE%'
  AND p.active = true
  AND EXTRACT(year FROM ms.month) = 2026
  AND EXTRACT(month FROM ms.month) = 5
  AND ms.name ILIKE '%enferm%'
LIMIT 1
RETURNING id, professional_id, schedule_id, shift_date, shift_type;
