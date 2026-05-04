-- =============================================================================
-- ATRIBUIR PROFISSIONAIS AOS SETORES (a partir das 3 planilhas)
--
-- Estratégia:
-- 1. Cria os 3 setores novos (idempotente)
-- 2. Para cada nome da planilha:
--    a. Match exato (unaccent + lower) → UPDATE department_id
--    b. Match por primeira+última palavra → UPDATE department_id
--    c. Sem match → INSERT como novo profissional
-- 3. Mostra relatório no final
-- =============================================================================

-- Garantir extensão unaccent disponível (idempotente)
CREATE EXTENSION IF NOT EXISTS unaccent;

DO $$
DECLARE
  enfermeiros_id uuid;
  tecnicos_id uuid;
  cme_id uuid;
  cat_enf_id uuid;
  cat_tec_id uuid;
  default_company_id uuid := '00000000-0000-0000-0000-000000000000';
  default_establishment_id uuid;
  rec RECORD;
  matched_count integer := 0;
  inserted_count integer := 0;
  ambiguous_count integer := 0;
  matched_id uuid;
BEGIN
  -- 1. Criar setores
  INSERT INTO departments (name, description) VALUES
    ('Enfermeiros', 'Equipe de enfermagem - Enfermeiros'),
    ('Técnicos de Enfermagem', 'Equipe de enfermagem - Técnicos'),
    ('Técnicos de Enfermagem CME', 'Técnicos de Enfermagem - Central de Material Esterilizado')
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO enfermeiros_id FROM departments WHERE name = 'Enfermeiros';
  SELECT id INTO tecnicos_id FROM departments WHERE name = 'Técnicos de Enfermagem';
  SELECT id INTO cme_id FROM departments WHERE name = 'Técnicos de Enfermagem CME';

  -- 2. Categorias
  SELECT id INTO cat_enf_id FROM professional_categories WHERE name = 'Enfermeiro';
  SELECT id INTO cat_tec_id FROM professional_categories WHERE name IN ('Técnico de Enfermagem', 'Técnico Enfermagem') ORDER BY name LIMIT 1;

  -- 3. Establishment padrão
  SELECT id INTO default_establishment_id FROM establishments LIMIT 1;
  IF default_establishment_id IS NULL THEN
    default_establishment_id := 'a0000000-0000-0000-0000-000000000001';
  END IF;

  -- 4. Para cada nome, fazer match e UPDATE/INSERT
  FOR rec IN (
    SELECT * FROM (VALUES
      ('ANA RITA BARREIRO CHAVES', 'Enfermeiros', 'Enfermeiro', 'ana', 'chaves', 'Ana Rita Barreiro Chaves'),
      ('CAMILA M. DE JESUS SANTOS', 'Enfermeiros', 'Enfermeiro', 'camila', 'santos', 'Camila M. de Jesus Santos'),
      ('CAMILA SANTOS PASCOAL', 'Enfermeiros', 'Enfermeiro', 'camila', 'pascoal', 'Camila Santos Pascoal'),
      ('CARLEANE MACEDO FERREIRA', 'Enfermeiros', 'Enfermeiro', 'carleane', 'ferreira', 'Carleane Macedo Ferreira'),
      ('CAROLINA SANTANA SILVA', 'Enfermeiros', 'Enfermeiro', 'carolina', 'silva', 'Carolina Santana Silva'),
      ('CRISTINA ALMEIDA SANTOS ARAGÃO', 'Enfermeiros', 'Enfermeiro', 'cristina', 'aragao', 'Cristina Almeida Santos Aragão'),
      ('DAISE VIANA COSTA ANDRADE', 'Enfermeiros', 'Enfermeiro', 'daise', 'andrade', 'Daise Viana Costa Andrade'),
      ('DANIELA ANDRADE MOUTINHO MONTENEGRO', 'Enfermeiros', 'Enfermeiro', 'daniela', 'montenegro', 'Daniela Andrade Moutinho Montenegro'),
      ('DANIELA PINHEIRO DOS SANTOS', 'Enfermeiros', 'Enfermeiro', 'daniela', 'santos', 'Daniela Pinheiro dos Santos'),
      ('DANIELLE APARECIDA BRITO DE SOUZA', 'Enfermeiros', 'Enfermeiro', 'danielle', 'souza', 'Danielle Aparecida Brito de Souza'),
      ('DENISE DE FIGUEREDO SOUZA', 'Enfermeiros', 'Enfermeiro', 'denise', 'souza', 'Denise de Figueredo Souza'),
      ('ELAINE CRISTINA C. M. VILLAS BOAS', 'Enfermeiros', 'Enfermeiro', 'elaine', 'boas', 'Elaine Cristina C. M. Villas Boas'),
      ('GABRIELA SOARES VIANA SILVA', 'Enfermeiros', 'Enfermeiro', 'gabriela', 'silva', 'Gabriela Soares Viana Silva'),
      ('IONE DOS SANTOS LIMA', 'Enfermeiros', 'Enfermeiro', 'ione', 'lima', 'Ione dos Santos Lima'),
      ('ISIS THAIANE MATTOS ROCHA PITA', 'Enfermeiros', 'Enfermeiro', 'isis', 'pita', 'Isis Thaiane Mattos Rocha Pita'),
      ('JUDITE SILVA SANTOS', 'Enfermeiros', 'Enfermeiro', 'judite', 'santos', 'Judite Silva Santos'),
      ('JULIANA RIOS DE ARAÚJO E ARAÚJO', 'Enfermeiros', 'Enfermeiro', 'juliana', 'araujo', 'Juliana Rios de Araújo e Araújo'),
      ('KARINA MANOELA DOS SANTOS', 'Enfermeiros', 'Enfermeiro', 'karina', 'santos', 'Karina Manoela dos Santos'),
      ('LUCINÉIA DOS SANTOS ANDRADE', 'Enfermeiros', 'Enfermeiro', 'lucineia', 'andrade', 'Lucinéia dos Santos Andrade'),
      ('LUCIVALDA FERREIRA LIMA', 'Enfermeiros', 'Enfermeiro', 'lucivalda', 'lima', 'Lucivalda Ferreira Lima'),
      ('MICHELE COSTA SALGUEIRO', 'Enfermeiros', 'Enfermeiro', 'michele', 'salgueiro', 'Michele Costa Salgueiro'),
      ('MILENA MACHADDO CERQUEIRA', 'Enfermeiros', 'Enfermeiro', 'milena', 'cerqueira', 'Milena Machaddo Cerqueira'),
      ('RENATA F. DE ALMEIDA FERNANDES', 'Enfermeiros', 'Enfermeiro', 'renata', 'fernandes', 'Renata F. de Almeida Fernandes'),
      ('RÍZIA DE MELO MENDES', 'Enfermeiros', 'Enfermeiro', 'rizia', 'mendes', 'Rízia de Melo Mendes'),
      ('TAIANE ALVES DOS SANTOS', 'Enfermeiros', 'Enfermeiro', 'taiane', 'santos', 'Taiane Alves dos Santos'),
      ('THAIS MENEZES DIAS', 'Enfermeiros', 'Enfermeiro', 'thais', 'dias', 'Thais Menezes Dias'),
      ('VERA LUCIA', 'Enfermeiros', 'Enfermeiro', 'vera', 'lucia', 'Vera Lucia'),
      ('VERA LUCIA FERREIRA', 'Enfermeiros', 'Enfermeiro', 'vera', 'ferreira', 'Vera Lucia Ferreira'),
      ('VIRGÍNIA MARIA DOS SANTOS', 'Enfermeiros', 'Enfermeiro', 'virginia', 'santos', 'Virgínia Maria dos Santos'),
      ('VIVIAN CRISTINA C. DE ARAUJO', 'Enfermeiros', 'Enfermeiro', 'vivian', 'araujo', 'Vivian Cristina C. de Araujo'),
      ('ALEXANDRE DE JESUS NUNES', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'alexandre', 'nunes', 'Alexandre de Jesus Nunes'),
      ('ALINE CRISTIANE S. RODRIGUES', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'aline', 'rodrigues', 'Aline Cristiane S. Rodrigues'),
      ('ANA CLÁUDIA LAGE FARIAS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'ana', 'farias', 'Ana Cláudia Lage Farias'),
      ('ANA MARIA SANTOS BONFIM', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'ana', 'bonfim', 'Ana Maria Santos Bonfim'),
      ('ANA PAULA MACEDO SA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'ana', 'sa', 'Ana Paula Macedo Sa'),
      ('ANDREIA  C. ROSENDO DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'andreia', 'santos', 'Andreia C. Rosendo dos Santos'),
      ('ANDREIA SILVA DE LIMA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'andreia', 'lima', 'Andreia Silva de Lima'),
      ('BARBARA MARCIA CARDOSO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'barbara', 'cardoso', 'Barbara Marcia Cardoso'),
      ('BRIANA CARLA JESUS DE LIMA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'briana', 'lima', 'Briana Carla Jesus de Lima'),
      ('BRUNO CERQUEIRA E SILVA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'bruno', 'silva', 'Bruno Cerqueira e Silva'),
      ('BÁRBARA SANTOS DE SOUZA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'barbara', 'souza', 'Bárbara Santos de Souza'),
      ('CLAUCIMENE P. CERQUEIRA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'claucimene', 'cerqueira', 'Claucimene P. Cerqueira'),
      ('DAIANE DOS ANJOS RODRIGUES', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'daiane', 'rodrigues', 'Daiane dos Anjos Rodrigues'),
      ('DANIELA CERQUEIRA SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'daniela', 'santos', 'Daniela Cerqueira Santos'),
      ('DEBORA SILVA MENDONÇA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'debora', 'mendonca', 'Debora Silva Mendonça'),
      ('DORALICE SILVA NETA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'doralice', 'neta', 'Doralice Silva Neta'),
      ('EDIVANEA MARIA MATOS DA SILVA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'edivanea', 'silva', 'Edivanea Maria Matos da Silva'),
      ('ELIANE REIS DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'eliane', 'santos', 'Eliane Reis dos Santos'),
      ('EMERSON SILVA FILHO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'emerson', 'filho', 'Emerson Silva Filho'),
      ('ERICA FERREIRA MENDONÇA BAZILIO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'erica', 'bazilio', 'Erica Ferreira Mendonça Bazilio'),
      ('FLÁVIO SANTOS SOUZA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'flavio', 'souza', 'Flávio Santos Souza'),
      ('GEANE DA CRUZ S.PARANÁ', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'geane', 'sparana', 'Geane da Cruz S.paraná'),
      ('GILVAN DE JESUS SILVA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'gilvan', 'silva', 'Gilvan de Jesus Silva'),
      ('GLÉCIA GOMES ROSA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'glecia', 'rosa', 'Glécia Gomes Rosa'),
      ('HELIO SANTOS SALES', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'helio', 'sales', 'Helio Santos Sales'),
      ('IRAILDES SANTOS ARAÚJO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'iraildes', 'araujo', 'Iraildes Santos Araújo'),
      ('IRIS JAQUELINE DO N. FALCÃO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'iris', 'falcao', 'Iris Jaqueline do N. Falcão'),
      ('IRLENE MARIA DIAS DA CONCEIÇÃO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'irlene', 'conceicao', 'Irlene Maria Dias da Conceição'),
      ('JOELMA M. DAS MONTANHAS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'joelma', 'montanhas', 'Joelma M. das Montanhas'),
      ('JUCIARA DE OLIVEIRA NUNES', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'juciara', 'nunes', 'Juciara de Oliveira Nunes'),
      ('JULIANA FREITAS SILVA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'juliana', 'silva', 'Juliana Freitas Silva'),
      ('JUSSARA O DE SOUZA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'jussara', 'souza', 'Jussara O de Souza'),
      ('KARINA SILVA C ROCHA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'karina', 'rocha', 'Karina Silva C Rocha'),
      ('LILIAN FLORES ARAÚJO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'lilian', 'araujo', 'Lilian Flores Araújo'),
      ('MARIA  V. S. DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'maria', 'santos', 'Maria V. S. dos Santos'),
      ('MARIA CLAÚDIA L. DA SILVA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'maria', 'silva', 'Maria Claúdia L. da Silva'),
      ('MARIA DUKE DE CERQUEIRA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'maria', 'cerqueira', 'Maria Duke de Cerqueira'),
      ('MARIZA DO NASCIMENTO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'mariza', 'nascimento', 'Mariza do Nascimento'),
      ('MILENA ISABEL RIBEIRO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'milena', 'ribeiro', 'Milena Isabel Ribeiro'),
      ('MIUCHA MARA CERQUEIRA SILVA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'miucha', 'silva', 'Miucha Mara Cerqueira Silva'),
      ('MOACIR NEVES DE JESUS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'moacir', 'jesus', 'Moacir Neves de Jesus'),
      ('MONICA DAS VIRGENS DE JESUS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'monica', 'jesus', 'Monica das Virgens de Jesus'),
      ('MONICA VIEIRA  MARQUES', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'monica', 'marques', 'Monica Vieira Marques'),
      ('NADJA DA SILVA S BARBOSA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'nadja', 'barbosa', 'Nadja da Silva S Barbosa'),
      ('NAIARA KELI LIMA DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'naiara', 'santos', 'Naiara Keli Lima dos Santos'),
      ('NATACHA SANTOS AVELINO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'natacha', 'avelino', 'Natacha Santos Avelino'),
      ('NILMA DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'nilma', 'santos', 'Nilma dos Santos'),
      ('NIVALDA SANTOS PEREIRA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'nivalda', 'pereira', 'Nivalda Santos Pereira'),
      ('OLGARINA PEREIRA SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'olgarina', 'santos', 'Olgarina Pereira Santos'),
      ('ORLANE DA S.  NOBERTO DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'orlane', 'santos', 'Orlane da S. Noberto dos Santos'),
      ('PATRÍCIA DE ARAÚJO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'patricia', 'araujo', 'Patrícia de Araújo'),
      ('REGINA GONZAGA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'regina', 'gonzaga', 'Regina Gonzaga'),
      ('RENATA DA COSTA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'renata', 'costa', 'Renata da Costa'),
      ('RODRIGO ALMEIDA AQUINO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'rodrigo', 'aquino', 'Rodrigo Almeida Aquino'),
      ('ROSANA MARIA DE A NUNES', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'rosana', 'nunes', 'Rosana Maria de A Nunes'),
      ('ROSILENE LAGE DE ALMEIDA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'rosilene', 'almeida', 'Rosilene Lage de Almeida'),
      ('SIDINEIDE JUSTO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'sidineide', 'justo', 'Sidineide Justo'),
      ('SILENE MARIA DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'silene', 'santos', 'Silene Maria dos Santos'),
      ('SILVIA ROBERTA B DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'silvia', 'santos', 'Silvia Roberta B dos Santos'),
      ('STEFANI LIMA DE SOUZA MAIA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'stefani', 'maia', 'Stefani Lima de Souza Maia'),
      ('SUZANA GUIMARÃES NUNES', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'suzana', 'nunes', 'Suzana Guimarães Nunes'),
      ('TAINA BARBARA DE JESUS TRIGUEIROS AS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'taina', 'as', 'Taina Barbara de Jesus Trigueiros As'),
      ('TATIANA SAID', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'tatiana', 'said', 'Tatiana Said'),
      ('TATIANE CONCEIÇÃO SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'tatiane', 'santos', 'Tatiane Conceição Santos'),
      ('TATIANE SANTOS DA SILVA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'tatiane', 'silva', 'Tatiane Santos da Silva'),
      ('TELMA REGINA DE J. DO MONTE', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'telma', 'monte', 'Telma Regina de J. do Monte'),
      ('THAINA BARBOSA SANTANA', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'thaina', 'santana', 'Thaina Barbosa Santana'),
      ('THAINA GOMES DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'thaina', 'santos', 'Thaina Gomes dos Santos'),
      ('VALDINERI SANTOS DE JESUS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'valdineri', 'jesus', 'Valdineri Santos de Jesus'),
      ('VANESSA SANTOS COELHO', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'vanessa', 'coelho', 'Vanessa Santos Coelho'),
      ('VIVIANE TEIXEIRA DE JESUS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'viviane', 'jesus', 'Viviane Teixeira de Jesus'),
      ('WELLINGTON E. DOS SANTOS', 'Técnicos de Enfermagem', 'Técnico de Enfermagem', 'wellington', 'santos', 'Wellington E. dos Santos'),
      ('ADRIANA SANTOS BARRETO', 'Técnicos de Enfermagem CME', 'Técnico de Enfermagem', 'adriana', 'barreto', 'Adriana Santos Barreto'),
      ('PATRÍCIA LAPA SANTANA', 'Técnicos de Enfermagem CME', 'Técnico de Enfermagem', 'patricia', 'santana', 'Patrícia Lapa Santana'),
      ('VIVIANE DE JESUS FERREIRA SOUZA', 'Técnicos de Enfermagem CME', 'Técnico de Enfermagem', 'viviane', 'souza', 'Viviane de Jesus Ferreira Souza')
    ) AS t(sheet_name, target_dept_label, target_cat_label, first_word, last_word, canonical)
  ) LOOP
    matched_id := NULL;

    -- 4a. Tentar match exato (unaccent + lower)
    SELECT id INTO matched_id
    FROM professionals
    WHERE unaccent(lower(regexp_replace(full_name, '\.', '', 'g'))) = unaccent(lower(rec.sheet_name))
    LIMIT 1;

    -- 4b. Se não, tentar match por primeira+última palavra significativa
    IF matched_id IS NULL THEN
      SELECT id INTO matched_id
      FROM professionals
      WHERE unaccent(lower(split_part(full_name, ' ', 1))) = rec.first_word
        AND unaccent(lower(reverse(split_part(reverse(full_name), ' ', 1)))) = rec.last_word
      LIMIT 1;
    END IF;

    IF matched_id IS NOT NULL THEN
      -- UPDATE: atribuir ao setor correto
      UPDATE professionals
      SET department_id = CASE rec.target_dept_label
        WHEN 'Enfermeiros' THEN enfermeiros_id
        WHEN 'Técnicos de Enfermagem' THEN tecnicos_id
        WHEN 'Técnicos de Enfermagem CME' THEN cme_id
      END
      WHERE id = matched_id;
      matched_count := matched_count + 1;
    ELSE
      -- INSERT como novo profissional
      INSERT INTO professionals (
        full_name, category_id, department_id, active,
        company_id, establishment_id, contracted_hours_per_month
      ) VALUES (
        rec.canonical,
        CASE rec.target_cat_label WHEN 'Enfermeiro' THEN cat_enf_id ELSE cat_tec_id END,
        CASE rec.target_dept_label
          WHEN 'Enfermeiros' THEN enfermeiros_id
          WHEN 'Técnicos de Enfermagem' THEN tecnicos_id
          WHEN 'Técnicos de Enfermagem CME' THEN cme_id
        END,
        true,
        default_company_id,
        default_establishment_id,
        180
      );
      inserted_count := inserted_count + 1;
      RAISE NOTICE 'INSERT novo: %', rec.canonical;
    END IF;
  END LOOP;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Profissionais já existentes (atribuídos ao novo setor): %', matched_count;
  RAISE NOTICE 'Profissionais novos cadastrados: %', inserted_count;
  RAISE NOTICE '------------------------------------------';
END $$;

-- Verificação
SELECT
  d.name AS setor,
  COUNT(p.id) AS profissionais
FROM departments d
LEFT JOIN professionals p ON p.department_id = d.id AND p.active = true
WHERE d.name IN ('Enfermeiros', 'Técnicos de Enfermagem', 'Técnicos de Enfermagem CME')
GROUP BY d.name
ORDER BY d.name;