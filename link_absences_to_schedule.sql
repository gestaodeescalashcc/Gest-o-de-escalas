-- =============================================================================
-- VINCULAR ABSENTEÍSMO À ESCALA MENSAL (monthly_schedules)
--
-- Adiciona coluna schedule_id em absences e popula os registros existentes
-- baseado em (department_id + start_date no mês da escala).
-- =============================================================================

-- 1. Adicionar coluna (idempotente)
ALTER TABLE absences
  ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES monthly_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_absences_schedule ON absences(schedule_id);

-- 2. Popular schedule_id para registros existentes
--    Match por: mesmo department_id + start_date dentro do mês da escala
UPDATE absences a
SET schedule_id = ms.id
FROM monthly_schedules ms
WHERE a.schedule_id IS NULL
  AND a.department_id = ms.department_id
  AND date_trunc('month', a.start_date) = date_trunc('month', ms.month);

-- 3. Verificação
SELECT
  COUNT(*) FILTER (WHERE schedule_id IS NOT NULL) AS vinculados,
  COUNT(*) FILTER (WHERE schedule_id IS NULL) AS sem_escala,
  COUNT(*) AS total
FROM absences;

-- 4. Detalhe: quantas ausências por escala
SELECT
  ms.name AS escala,
  ms.month::date AS mes,
  d.name AS setor,
  COUNT(a.id) AS qtd_absences
FROM absences a
LEFT JOIN monthly_schedules ms ON ms.id = a.schedule_id
LEFT JOIN departments d ON d.id = a.department_id
GROUP BY ms.name, ms.month, d.name
ORDER BY ms.month DESC NULLS LAST, d.name;
