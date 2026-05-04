-- =============================================================================
-- REPLICAR ESCALA DE TÉCNICOS DE ENFERMAGEM CME DE MAIO/2026 PARA JUNHO/2026
--
-- Setor destino: Técnicos de Enfermagem CME
-- Mês destino: JUNHO/2026 (30 dias)
-- =============================================================================

DO $$
DECLARE
  v_dept_id uuid;
  v_schedule_id uuid;
  v_admin_id uuid;
  rec RECORD;
  v_prof_id uuid;
  matched_count integer := 0;
  inserted_count integer := 0;
  skipped_count integer := 0;
BEGIN
  SELECT id INTO v_dept_id FROM departments WHERE name = 'Técnicos de Enfermagem CME' AND active = true LIMIT 1;
  IF v_dept_id IS NULL THEN
    RAISE EXCEPTION 'Setor Técnicos de Enfermagem CME não encontrado.';
  END IF;

  SELECT id INTO v_admin_id
  FROM system_users
  WHERE role_id = (SELECT id FROM user_roles WHERE name = 'Administrador' LIMIT 1)
  AND active = true
  ORDER BY created_at LIMIT 1;

  SELECT id INTO v_schedule_id
  FROM monthly_schedules
  WHERE department_id = v_dept_id AND month = '2026-06-01' LIMIT 1;

  IF v_schedule_id IS NULL THEN
    INSERT INTO monthly_schedules (department_id, month, name, status, created_by)
    VALUES (v_dept_id, '2026-06-01', 'Escala Técnicos CME - Junho de 2026', 'Rascunho', v_admin_id)
    RETURNING id INTO v_schedule_id;
    RAISE NOTICE 'Escala criada: %', v_schedule_id;
  ELSE
    RAISE NOTICE 'Escala já existia, usando: %', v_schedule_id;
  END IF;

  FOR rec IN (
    SELECT * FROM (VALUES
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 1, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 3, 'M', 'Manhã (7h às 13h) 6h', '07:00', '13:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 5, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 7, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 11, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 13, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 15, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 19, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 21, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 23, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 25, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 27, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'viviane', 'souza', 29, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 2, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 4, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 6, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 8, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 12, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 14, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 16, 'M', 'Manhã (7h às 13h) 6h', '07:00', '13:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 18, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 20, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 22, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 26, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 28, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ADRIANA SANTOS BARRETO', 'adriana', 'barreto', 30, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00')
    ) AS t(sheet_name, first_word, last_word, day, code, type_name, start_time, end_time)
  ) LOOP
    SELECT id INTO v_prof_id
    FROM professionals
    WHERE active = true
      AND department_id = v_dept_id
      AND unaccent(lower(split_part(full_name, ' ', 1))) = rec.first_word
      AND unaccent(lower(reverse(split_part(reverse(full_name), ' ', 1)))) = rec.last_word
    LIMIT 1;

    IF v_prof_id IS NULL THEN
      SELECT id INTO v_prof_id
      FROM professionals
      WHERE active = true
        AND department_id = v_dept_id
        AND unaccent(lower(regexp_replace(full_name, '\.', '', 'g'))) = unaccent(lower(rec.sheet_name))
      LIMIT 1;
    END IF;

    IF v_prof_id IS NULL THEN
      RAISE NOTICE 'NÃO ENCONTRADO no setor Técnicos de Enfermagem CME: %', rec.sheet_name;
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO shifts (
        professional_id, department_id, schedule_id,
        shift_date, shift_type, start_time, end_time,
        status, created_by
      ) VALUES (
        v_prof_id, v_dept_id, v_schedule_id,
        ('2026-06-' || lpad(rec.day::text, 2, '0'))::date,
        rec.type_name, rec.start_time::time, rec.end_time::time,
        'Agendado', v_admin_id
      );
      inserted_count := inserted_count + 1;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
    matched_count := matched_count + 1;
  END LOOP;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Setor: Técnicos de Enfermagem CME';
  RAISE NOTICE 'Turnos processados (match): %', matched_count;
  RAISE NOTICE 'Turnos inseridos: %', inserted_count;
  RAISE NOTICE 'Turnos pulados (sem match): %', skipped_count;
  RAISE NOTICE '------------------------------------------';
END $$;

SELECT
  p.full_name,
  COUNT(s.id) as total_turnos
FROM monthly_schedules ms
JOIN shifts s ON s.schedule_id = ms.id
JOIN professionals p ON p.id = s.professional_id
WHERE ms.month = '2026-06-01'
  AND ms.department_id = (SELECT id FROM departments WHERE name = 'Técnicos de Enfermagem CME')
GROUP BY p.full_name
ORDER BY p.full_name;
