-- =============================================================================
-- AJUSTAR TÉCNICOS A 12 DIAS EM JUNHO/2026
--
-- Em junho (30 dias) o padrão é 12 dias trabalhados.
-- Quem trabalhava no dia 31 de maio: já perdeu 1 dia naturalmente → 12 dias ✓
-- Quem NÃO trabalhava no dia 31: ficou com 13 → precisa remover 1.
--
-- Estratégia: remover o turno do dia mais ALTO (último) de cada técnico
-- que tem 13 ou mais turnos em junho/2026.
-- =============================================================================

DO $$
DECLARE
  v_dept_id_tec uuid;
  v_dept_id_cme uuid;
  v_schedule_id_tec uuid;
  v_schedule_id_cme uuid;
  rec RECORD;
  removed integer := 0;
BEGIN
  SELECT id INTO v_dept_id_tec FROM departments WHERE name = 'Técnicos de Enfermagem' LIMIT 1;
  SELECT id INTO v_dept_id_cme FROM departments WHERE name = 'Técnicos de Enfermagem CME' LIMIT 1;

  SELECT id INTO v_schedule_id_tec FROM monthly_schedules
  WHERE department_id = v_dept_id_tec AND month = '2026-06-01' LIMIT 1;

  SELECT id INTO v_schedule_id_cme FROM monthly_schedules
  WHERE department_id = v_dept_id_cme AND month = '2026-06-01' LIMIT 1;

  -- Para cada profissional dos setores Técnicos / Técnicos CME que tem mais de 12 turnos
  FOR rec IN (
    SELECT
      p.id AS prof_id,
      p.full_name,
      COUNT(s.id) AS total_turnos
    FROM professionals p
    LEFT JOIN shifts s ON s.professional_id = p.id
      AND s.schedule_id IN (v_schedule_id_tec, v_schedule_id_cme)
    WHERE p.active = true
      AND p.department_id IN (v_dept_id_tec, v_dept_id_cme)
    GROUP BY p.id, p.full_name
    HAVING COUNT(s.id) > 12
    ORDER BY p.full_name
  ) LOOP
    -- Remover os turnos extras do dia mais alto (último) até ficar com 12
    DELETE FROM shifts
    WHERE id IN (
      SELECT id FROM shifts
      WHERE professional_id = rec.prof_id
        AND schedule_id IN (v_schedule_id_tec, v_schedule_id_cme)
      ORDER BY shift_date DESC
      LIMIT (rec.total_turnos - 12)
    );
    removed := removed + (rec.total_turnos - 12);
    RAISE NOTICE 'Removidos % turno(s) de %', (rec.total_turnos - 12), rec.full_name;
  END LOOP;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Total de turnos removidos: %', removed;
  RAISE NOTICE 'Todos os técnicos agora devem ter <= 12 dias em junho/2026.';
END $$;

-- Verificação: contagem por profissional
SELECT
  p.full_name,
  d.name AS setor,
  COUNT(s.id) AS turnos_junho
FROM professionals p
JOIN departments d ON d.id = p.department_id
LEFT JOIN shifts s ON s.professional_id = p.id
  AND s.shift_date >= '2026-06-01'
  AND s.shift_date <= '2026-06-30'
WHERE p.active = true
  AND d.name IN ('Técnicos de Enfermagem', 'Técnicos de Enfermagem CME')
GROUP BY p.full_name, d.name
ORDER BY turnos_junho DESC, p.full_name;
