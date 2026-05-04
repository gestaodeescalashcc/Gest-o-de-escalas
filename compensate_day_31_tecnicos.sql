-- =============================================================================
-- COMPENSAR DIA 31 DE MAIO: adicionar 1 turno extra no dia 30 de JUNHO
-- para os tecnicos que tinham turno no dia 31 de maio.
--
-- Logica: para cada tecnico afetado:
--   - Se dia 30 de junho ja tem turno: ignora (unique constraint protege)
--   - Se dia 30 esta livre: adiciona o mesmo tipo que tinha no dia 31 maio
-- =============================================================================

DO $$
DECLARE
  v_dept_id uuid;
  v_admin_id uuid;
  v_schedule_id uuid;
  v_prof_id uuid;
  rec RECORD;
  added integer := 0;
  skipped integer := 0;
  not_found integer := 0;
BEGIN
  SELECT id INTO v_dept_id FROM departments WHERE name = 'Técnicos de Enfermagem' LIMIT 1;

  SELECT id INTO v_admin_id FROM system_users
  WHERE role_id = (SELECT id FROM user_roles WHERE name = 'Administrador' LIMIT 1)
  AND active = true ORDER BY created_at LIMIT 1;

  SELECT id INTO v_schedule_id FROM monthly_schedules
  WHERE department_id = v_dept_id AND month = '2026-06-01' LIMIT 1;

  IF v_schedule_id IS NULL THEN
    RAISE EXCEPTION 'Escala de junho 2026 dos Tecnicos nao encontrada. Rode antes o replicate_tecnicos_maio_to_junho.sql';
  END IF;

  FOR rec IN (
    SELECT * FROM (VALUES
      ('GILVAN DE JESUS SILVA', 'gilvan', 'silva', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ANDREIA  C. ROSENDO DOS SANTOS', 'andreia', 'santos', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ALINE CRISTIANE S. RODRIGUES', 'aline', 'rodrigues', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('JOELMA M. DAS MONTANHAS', 'joelma', 'montanhas', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('SILENE MARIA DOS SANTOS', 'silene', 'santos', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('FLÁVIO SANTOS SOUZA', 'flavio', 'souza', 'M', 'Manhã (7h às 13h) 6h', '07:00', '13:00'),
      ('DAIANE DOS ANJOS RODRIGUES', 'daiane', 'rodrigues', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('JULIANA FREITAS SILVA', 'juliana', 'silva', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('MIUCHA MARA CERQUEIRA SILVA', 'miucha', 'silva', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('ANA MARIA SANTOS BONFIM', 'ana', 'bonfim', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('JUCIARA DE OLIVEIRA NUNES', 'juciara', 'nunes', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('ALEXANDRE DE JESUS NUNES', 'alexandre', 'nunes', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('SUZANA GUIMARÃES NUNES', 'suzana', 'nunes', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('TATIANE SANTOS DA SILVA', 'tatiane', 'silva', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('TELMA REGINA DE J. DO MONTE', 'telma', 'monte', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('NAIARA KELI LIMA DOS SANTOS', 'naiara', 'santos', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('MILENA ISABEL RIBEIRO', 'milena', 'ribeiro', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('ANA CLÁUDIA LAGE FARIAS', 'ana', 'farias', 'SN', 'Serviço Noturno (19h às 7h) 12h', '19:00', '07:00'),
      ('WELLINGTON E. DOS SANTOS', 'wellington', 'santos', 'T', 'Tarde (12h às 18h) 6h', '12:00', '18:00'),
      ('NILMA DOS SANTOS', 'nilma', 'santos', 'T', 'Tarde (12h às 18h) 6h', '12:00', '18:00'),
      ('ROSILENE LAGE DE ALMEIDA', 'rosilene', 'almeida', 'T', 'Tarde (12h às 18h) 6h', '12:00', '18:00'),
      ('GLÉCIA GOMES ROSA', 'glecia', 'rosa', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('MARIA CLAÚDIA L. DA SILVA', 'maria', 'silva', 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('THAINA BARBOSA SANTANA', 'thaina', 'santana', 'M', 'Manhã (7h às 13h) 6h', '07:00', '13:00'),
      ('HELIO SANTOS SALES', 'helio', 'sales', 'M', 'Manhã (7h às 13h) 6h', '07:00', '13:00'),
      ('BRUNO CERQUEIRA E SILVA', 'bruno', 'silva', 'M', 'Manhã (7h às 13h) 6h', '07:00', '13:00'),
      ('NIVALDA SANTOS PEREIRA', 'nivalda', 'pereira', 'M', 'Manhã (7h às 13h) 6h', '07:00', '13:00')
    ) AS t(sheet_name, first_word, last_word, code, type_name, start_time, end_time)
  ) LOOP
    SELECT id INTO v_prof_id
    FROM professionals
    WHERE active = true AND department_id = v_dept_id
      AND unaccent(lower(split_part(full_name, ' ', 1))) = rec.first_word
      AND unaccent(lower(reverse(split_part(reverse(full_name), ' ', 1)))) = rec.last_word
    LIMIT 1;

    IF v_prof_id IS NULL THEN
      not_found := not_found + 1;
      RAISE NOTICE 'Nao encontrado: %', rec.sheet_name;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO shifts (
        professional_id, department_id, schedule_id,
        shift_date, shift_type, start_time, end_time, status, created_by
      ) VALUES (
        v_prof_id, v_dept_id, v_schedule_id,
        '2026-06-30', rec.type_name,
        rec.start_time::time, rec.end_time::time, 'Agendado', v_admin_id
      );
      added := added + 1;
    EXCEPTION WHEN unique_violation THEN
      skipped := skipped + 1;
      RAISE NOTICE 'Dia 30 ja ocupado para %', rec.sheet_name;
    END;
  END LOOP;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Turnos extras adicionados no dia 30/06: %', added;
  RAISE NOTICE 'Turnos pulados (dia 30 ja ocupado): %', skipped;
  RAISE NOTICE 'Profissionais nao encontrados: %', not_found;
END $$;

-- Verificacao
SELECT
  p.full_name,
  COUNT(s.id) AS turnos_junho
FROM monthly_schedules ms
JOIN shifts s ON s.schedule_id = ms.id
JOIN professionals p ON p.id = s.professional_id
WHERE ms.month = '2026-06-01'
  AND ms.department_id = (SELECT id FROM departments WHERE name = 'Técnicos de Enfermagem')
GROUP BY p.full_name
ORDER BY turnos_junho DESC, p.full_name;
