-- =============================================================================
-- REPLICAR ESCALA DE ENFERMEIROS DE MAIO/2026 PARA JUNHO/2026
--
-- Fonte: ESCALA DE ENFERMEIROS.xlsx, aba MAIO 26
-- Excluídos do quadro: Denise (Figueredo/Figueireido) Souza e
--                      Daniela Pinheiro dos Santos
-- Mês destino: JUNHO/2026 (30 dias — dia 31/maio não tem correspondente)
-- Mapeamento: P=24, MT=MT, SD=SD, SN=SN
-- =============================================================================

DO $$
DECLARE
  v_dept_id uuid;
  v_schedule_id uuid;
  v_admin_id uuid;
  v_default_company_id uuid := '00000000-0000-0000-0000-000000000000';
  rec RECORD;
  v_prof_id uuid;
  matched_count integer := 0;
  inserted_count integer := 0;
  skipped_count integer := 0;
BEGIN
  -- Pegar setor Enfermeiros
  SELECT id INTO v_dept_id FROM departments WHERE name = 'Enfermeiros' AND active = true LIMIT 1;
  IF v_dept_id IS NULL THEN
    RAISE EXCEPTION 'Setor Enfermeiros não encontrado.';
  END IF;

  -- Pegar um administrador para usar como created_by
  SELECT id INTO v_admin_id
  FROM system_users
  WHERE role_id = (SELECT id FROM user_roles WHERE name = 'Administrador' LIMIT 1)
  AND active = true
  ORDER BY created_at LIMIT 1;

  -- Criar escala de Junho 2026 (idempotente)
  SELECT id INTO v_schedule_id
  FROM monthly_schedules
  WHERE department_id = v_dept_id AND month = '2026-06-01' LIMIT 1;

  IF v_schedule_id IS NULL THEN
    INSERT INTO monthly_schedules (department_id, month, name, status, created_by)
    VALUES (v_dept_id, '2026-06-01', 'Escala Enfermeiros - Junho de 2026', 'Rascunho', v_admin_id)
    RETURNING id INTO v_schedule_id;
    RAISE NOTICE 'Escala criada: %', v_schedule_id;
  ELSE
    RAISE NOTICE 'Escala já existia, usando: %', v_schedule_id;
  END IF;

  -- Inserir cada turno
  FOR rec IN (
    SELECT * FROM (VALUES
      ('LUCINÉIA DOS SANTOS ANDRADE', 'lucineia', 'andrade', 2, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCINÉIA DOS SANTOS ANDRADE', 'lucineia', 'andrade', 7, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCINÉIA DOS SANTOS ANDRADE', 'lucineia', 'andrade', 12, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCINÉIA DOS SANTOS ANDRADE', 'lucineia', 'andrade', 17, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCINÉIA DOS SANTOS ANDRADE', 'lucineia', 'andrade', 20, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('LUCINÉIA DOS SANTOS ANDRADE', 'lucineia', 'andrade', 22, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCINÉIA DOS SANTOS ANDRADE', 'lucineia', 'andrade', 24, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('LUCINÉIA DOS SANTOS ANDRADE', 'lucineia', 'andrade', 27, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'isis', 'pita', 4, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'isis', 'pita', 9, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'isis', 'pita', 14, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'isis', 'pita', 17, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'isis', 'pita', 19, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'isis', 'pita', 24, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'isis', 'pita', 27, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'isis', 'pita', 29, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('THAIS MENEZES DIAS', 'thais', 'dias', 2, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('THAIS MENEZES DIAS', 'thais', 'dias', 4, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('THAIS MENEZES DIAS', 'thais', 'dias', 9, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('THAIS MENEZES DIAS', 'thais', 'dias', 12, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('THAIS MENEZES DIAS', 'thais', 'dias', 14, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('THAIS MENEZES DIAS', 'thais', 'dias', 19, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('THAIS MENEZES DIAS', 'thais', 'dias', 24, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('THAIS MENEZES DIAS', 'thais', 'dias', 29, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELLE APARECIDA B. DE SOUZA', 'danielle', 'souza', 1, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELLE APARECIDA B. DE SOUZA', 'danielle', 'souza', 6, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELLE APARECIDA B. DE SOUZA', 'danielle', 'souza', 9, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('DANIELLE APARECIDA B. DE SOUZA', 'danielle', 'souza', 11, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELLE APARECIDA B. DE SOUZA', 'danielle', 'souza', 15, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELLE APARECIDA B. DE SOUZA', 'danielle', 'souza', 21, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELLE APARECIDA B. DE SOUZA', 'danielle', 'souza', 26, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELLE APARECIDA B. DE SOUZA', 'danielle', 'souza', 30, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('JULIANA RIOS DE ARAUJO E ARAUJO', 'juliana', 'araujo', 1, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('JULIANA RIOS DE ARAUJO E ARAUJO', 'juliana', 'araujo', 4, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('JULIANA RIOS DE ARAUJO E ARAUJO', 'juliana', 'araujo', 9, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('JULIANA RIOS DE ARAUJO E ARAUJO', 'juliana', 'araujo', 14, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('JULIANA RIOS DE ARAUJO E ARAUJO', 'juliana', 'araujo', 19, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('JULIANA RIOS DE ARAUJO E ARAUJO', 'juliana', 'araujo', 22, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('JULIANA RIOS DE ARAUJO E ARAUJO', 'juliana', 'araujo', 24, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('JULIANA RIOS DE ARAUJO E ARAUJO', 'juliana', 'araujo', 29, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA SANTOS PASCOAL', 'camila', 'pascoal', 1, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA SANTOS PASCOAL', 'camila', 'pascoal', 6, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA SANTOS PASCOAL', 'camila', 'pascoal', 11, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA SANTOS PASCOAL', 'camila', 'pascoal', 14, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('CAMILA SANTOS PASCOAL', 'camila', 'pascoal', 16, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA SANTOS PASCOAL', 'camila', 'pascoal', 21, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA SANTOS PASCOAL', 'camila', 'pascoal', 26, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MICHELE COSTA SALGUEIRO', 'michele', 'salgueiro', 2, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MICHELE COSTA SALGUEIRO', 'michele', 'salgueiro', 7, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MICHELE COSTA SALGUEIRO', 'michele', 'salgueiro', 10, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('MICHELE COSTA SALGUEIRO', 'michele', 'salgueiro', 12, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MICHELE COSTA SALGUEIRO', 'michele', 'salgueiro', 17, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MICHELE COSTA SALGUEIRO', 'michele', 'salgueiro', 22, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MICHELE COSTA SALGUEIRO', 'michele', 'salgueiro', 25, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('MICHELE COSTA SALGUEIRO', 'michele', 'salgueiro', 27, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCIVALDA FERREIRA LIMA', 'lucivalda', 'lima', 3, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCIVALDA FERREIRA LIMA', 'lucivalda', 'lima', 8, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCIVALDA FERREIRA LIMA', 'lucivalda', 'lima', 13, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCIVALDA FERREIRA LIMA', 'lucivalda', 'lima', 16, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('LUCIVALDA FERREIRA LIMA', 'lucivalda', 'lima', 18, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCIVALDA FERREIRA LIMA', 'lucivalda', 'lima', 21, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('LUCIVALDA FERREIRA LIMA', 'lucivalda', 'lima', 23, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('LUCIVALDA FERREIRA LIMA', 'lucivalda', 'lima', 28, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'virginia', 'santos', 2, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'virginia', 'santos', 7, 'SD', 'Serviço Diurno (7h às 19h) 12h', '07:00', '19:00'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'virginia', 'santos', 12, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'virginia', 'santos', 17, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'virginia', 'santos', 19, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'virginia', 'santos', 22, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'virginia', 'santos', 25, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'virginia', 'santos', 27, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELA A. M. MONTENEGRO', 'daniela', 'montenegro', 3, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('DANIELA A. M. MONTENEGRO', 'daniela', 'montenegro', 5, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELA A. M. MONTENEGRO', 'daniela', 'montenegro', 10, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELA A. M. MONTENEGRO', 'daniela', 'montenegro', 15, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELA A. M. MONTENEGRO', 'daniela', 'montenegro', 18, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('DANIELA A. M. MONTENEGRO', 'daniela', 'montenegro', 20, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELA A. M. MONTENEGRO', 'daniela', 'montenegro', 25, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DANIELA A. M. MONTENEGRO', 'daniela', 'montenegro', 30, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('GABRIELA SOARES VIANA SILVA', 'gabriela', 'silva', 1, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('GABRIELA SOARES VIANA SILVA', 'gabriela', 'silva', 6, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('GABRIELA SOARES VIANA SILVA', 'gabriela', 'silva', 11, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('GABRIELA SOARES VIANA SILVA', 'gabriela', 'silva', 16, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('GABRIELA SOARES VIANA SILVA', 'gabriela', 'silva', 21, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('GABRIELA SOARES VIANA SILVA', 'gabriela', 'silva', 26, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('GABRIELA SOARES VIANA SILVA', 'gabriela', 'silva', 29, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('IONE DOS SANTOS LIMA', 'ione', 'lima', 2, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('IONE DOS SANTOS LIMA', 'ione', 'lima', 4, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('IONE DOS SANTOS LIMA', 'ione', 'lima', 9, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('IONE DOS SANTOS LIMA', 'ione', 'lima', 12, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('IONE DOS SANTOS LIMA', 'ione', 'lima', 14, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('IONE DOS SANTOS LIMA', 'ione', 'lima', 19, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('IONE DOS SANTOS LIMA', 'ione', 'lima', 24, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('IONE DOS SANTOS LIMA', 'ione', 'lima', 29, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VERA LUCIA FERREIRA', 'vera', 'ferreira', 1, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VERA LUCIA FERREIRA', 'vera', 'ferreira', 4, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('VERA LUCIA FERREIRA', 'vera', 'ferreira', 7, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VERA LUCIA FERREIRA', 'vera', 'ferreira', 11, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VERA LUCIA FERREIRA', 'vera', 'ferreira', 16, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VERA LUCIA FERREIRA', 'vera', 'ferreira', 20, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('VERA LUCIA FERREIRA', 'vera', 'ferreira', 26, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DAISE VIANA COSTA ANDRADE', 'daise', 'andrade', 3, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DAISE VIANA COSTA ANDRADE', 'daise', 'andrade', 8, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DAISE VIANA COSTA ANDRADE', 'daise', 'andrade', 10, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('DAISE VIANA COSTA ANDRADE', 'daise', 'andrade', 13, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DAISE VIANA COSTA ANDRADE', 'daise', 'andrade', 18, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DAISE VIANA COSTA ANDRADE', 'daise', 'andrade', 23, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('DAISE VIANA COSTA ANDRADE', 'daise', 'andrade', 26, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('DAISE VIANA COSTA ANDRADE', 'daise', 'andrade', 28, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('RÍZIA DE MELO MENDES', 'rizia', 'mendes', 3, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('RÍZIA DE MELO MENDES', 'rizia', 'mendes', 5, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('RÍZIA DE MELO MENDES', 'rizia', 'mendes', 10, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('RÍZIA DE MELO MENDES', 'rizia', 'mendes', 15, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('RÍZIA DE MELO MENDES', 'rizia', 'mendes', 20, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('RÍZIA DE MELO MENDES', 'rizia', 'mendes', 22, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('RÍZIA DE MELO MENDES', 'rizia', 'mendes', 25, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('RÍZIA DE MELO MENDES', 'rizia', 'mendes', 30, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA M. DE JESUS SANTOS', 'camila', 'santos', 1, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA M. DE JESUS SANTOS', 'camila', 'santos', 6, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA M. DE JESUS SANTOS', 'camila', 'santos', 11, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA M. DE JESUS SANTOS', 'camila', 'santos', 13, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('CAMILA M. DE JESUS SANTOS', 'camila', 'santos', 17, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('CAMILA M. DE JESUS SANTOS', 'camila', 'santos', 21, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('CAMILA M. DE JESUS SANTOS', 'camila', 'santos', 26, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'vivian', 'araujo', 3, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'vivian', 'araujo', 6, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'vivian', 'araujo', 8, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'vivian', 'araujo', 13, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'vivian', 'araujo', 16, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'vivian', 'araujo', 18, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'vivian', 'araujo', 23, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'vivian', 'araujo', 28, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MILENA MACHADDO CERQUEIRA', 'milena', 'cerqueira', 5, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MILENA MACHADDO CERQUEIRA', 'milena', 'cerqueira', 8, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('MILENA MACHADDO CERQUEIRA', 'milena', 'cerqueira', 10, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MILENA MACHADDO CERQUEIRA', 'milena', 'cerqueira', 15, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MILENA MACHADDO CERQUEIRA', 'milena', 'cerqueira', 20, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MILENA MACHADDO CERQUEIRA', 'milena', 'cerqueira', 23, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('MILENA MACHADDO CERQUEIRA', 'milena', 'cerqueira', 25, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('MILENA MACHADDO CERQUEIRA', 'milena', 'cerqueira', 30, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('KARINA MANOELA DOS SANTOS', 'karina', 'santos', 4, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('KARINA MANOELA DOS SANTOS', 'karina', 'santos', 7, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('KARINA MANOELA DOS SANTOS', 'karina', 'santos', 9, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('KARINA MANOELA DOS SANTOS', 'karina', 'santos', 14, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('KARINA MANOELA DOS SANTOS', 'karina', 'santos', 19, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('KARINA MANOELA DOS SANTOS', 'karina', 'santos', 21, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('KARINA MANOELA DOS SANTOS', 'karina', 'santos', 24, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('KARINA MANOELA DOS SANTOS', 'karina', 'santos', 29, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ELAINE CRISTINA C. M. VILLAS BOAS', 'elaine', 'boas', 3, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ELAINE CRISTINA C. M. VILLAS BOAS', 'elaine', 'boas', 8, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ELAINE CRISTINA C. M. VILLAS BOAS', 'elaine', 'boas', 11, 'MT', 'Manhã e Tarde (8h às 17h) 8h', '08:00', '17:00'),
      ('ELAINE CRISTINA C. M. VILLAS BOAS', 'elaine', 'boas', 13, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ELAINE CRISTINA C. M. VILLAS BOAS', 'elaine', 'boas', 18, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ELAINE CRISTINA C. M. VILLAS BOAS', 'elaine', 'boas', 23, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00'),
      ('ELAINE CRISTINA C. M. VILLAS BOAS', 'elaine', 'boas', 28, '24', 'Plantão 24h (7h às 7h) 24h', '07:00', '07:00')
    ) AS t(sheet_name, first_word, last_word, day, code, type_name, start_time, end_time)
  ) LOOP
    -- Match do profissional (fuzzy: primeira + última palavra)
    SELECT id INTO v_prof_id
    FROM professionals
    WHERE active = true
      AND department_id = v_dept_id
      AND unaccent(lower(split_part(full_name, ' ', 1))) = rec.first_word
      AND unaccent(lower(reverse(split_part(reverse(full_name), ' ', 1)))) = rec.last_word
    LIMIT 1;

    -- Fallback: tentar match por nome exato (sem acentos/case)
    IF v_prof_id IS NULL THEN
      SELECT id INTO v_prof_id
      FROM professionals
      WHERE active = true
        AND department_id = v_dept_id
        AND unaccent(lower(regexp_replace(full_name, '\.', '', 'g'))) = unaccent(lower(rec.sheet_name))
      LIMIT 1;
    END IF;

    IF v_prof_id IS NULL THEN
      RAISE NOTICE 'PROFISSIONAL NÃO ENCONTRADO no setor Enfermeiros: %', rec.sheet_name;
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- Inserir turno (idempotente: ignora se já existe via unique constraint)
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
      -- Turno já existe, ignorar
      NULL;
    END;
    matched_count := matched_count + 1;
  END LOOP;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Turnos processados (match): %', matched_count;
  RAISE NOTICE 'Turnos inseridos: %', inserted_count;
  RAISE NOTICE 'Turnos pulados (sem match): %', skipped_count;
  RAISE NOTICE '------------------------------------------';
END $$;

-- Verificação
SELECT
  p.full_name,
  COUNT(s.id) as total_turnos,
  string_agg(DISTINCT s.shift_type, ', ') as tipos
FROM monthly_schedules ms
JOIN shifts s ON s.schedule_id = ms.id
JOIN professionals p ON p.id = s.professional_id
WHERE ms.month = '2026-06-01'
  AND ms.department_id = (SELECT id FROM departments WHERE name = 'Enfermeiros')
GROUP BY p.full_name
ORDER BY p.full_name;
