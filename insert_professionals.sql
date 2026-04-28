-- =============================================================================
-- INSERIR PROFISSIONAIS DA PLANILHA SGI NO SISTEMA
-- Gerado em: 2026-04-14
--
-- - Profissionais são cadastrados SEM conta de login (apenas na tabela professionals)
-- - Mapeamento automático de cargo → categoria + departamento
-- - Cargos ambíguos (Enfermagem, por exemplo) ficam sem departamento
-- - Novas categorias são criadas quando necessário
-- =============================================================================

-- =============================================================================
-- PARTE 1: CRIAR CATEGORIAS QUE NÃO EXISTEM
-- =============================================================================

INSERT INTO professional_categories (name, color) VALUES
  ('Nutricionista', '#84CC16'),
  ('Fonoaudiólogo', '#0EA5E9'),
  ('Técnico de Informática', '#64748B'),
  ('Diretor', '#DC2626'),
  ('Assessor', '#A855F7')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- PARTE 2: INSERIR PROFISSIONAIS
-- Usa subqueries para buscar category_id e department_id pelos nomes
-- ON CONFLICT não se aplica pois não há unique constraint em full_name,
-- então usamos um WHERE NOT EXISTS para evitar duplicatas
-- =============================================================================

DO $$
DECLARE
  default_company_id uuid := '00000000-0000-0000-0000-000000000000';
  default_establishment_id uuid;
  inserted_count integer := 0;
  skipped_count integer := 0;
  prof RECORD;
BEGIN
  -- Buscar establishment padrão
  SELECT id INTO default_establishment_id FROM establishments LIMIT 1;
  IF default_establishment_id IS NULL THEN
    default_establishment_id := 'a0000000-0000-0000-0000-000000000001';
  END IF;

  FOR prof IN (
    SELECT * FROM (VALUES
      -- Nome, Categoria, Departamento (NULL = sem setor), Matrícula, CPF
      ('Adonias de Souza Santos', 'Assessor', NULL, '12488', '058.029.165-08'),
      ('Adriana Santos Barreto', 'Técnico de Enfermagem', NULL, '1199', '865.934.395-68'),
      ('Adriane Maria Rocha Oliveira', 'Administrativo', 'Administrativo', NULL, '000.000.000-00'),
      ('Adroaldo Nascimento dos Santos', 'Supervisor', 'Administrativo', '17853', '790.739.995-53'),
      ('Aieza dos Santos Cardoso', 'Fisioterapeuta', 'Fisioterapia', '17905', '045.160.815-12'),
      ('Aislan Souza de Jesus', 'Supervisor', 'Transporte/Patrimônio', '17814', '782.713.555-20'),
      ('Alexandre de Jesus Nunes', 'Técnico de Enfermagem', NULL, '1198', '019.170.385-00'),
      ('Aline Cristiane Santos Rodrigues Jesus', 'Técnico de Enfermagem', NULL, '178', '014.867.695-27'),
      ('Aline Mendes Cruz Sena', 'Coordenador', 'SCIH', '17912', '050.914.245-12'),
      ('Aline Souza dos Santos', 'Administrativo', 'Administrativo', '17953', '026.214.725-40'),
      ('Ana Claudia Costa Santos', 'Assistente Social', 'Serviço Social', '17932', '858.507.995-91'),
      ('Ana Claudia Lage Farias', 'Técnico de Enfermagem', NULL, '17867', '677.344.805-00'),
      ('Ana Clea de Santana Sampaio', 'Assistente Social', 'Serviço Social', '17926', '002.130.165-40'),
      ('Ana Paula Macedo Souza Silva', 'Técnico de Enfermagem', NULL, '17871', '827.282.245-87'),
      ('Ana Paula Monteiro', 'Gerente', NULL, '17802', '872.935.015-87'),
      ('Ana Rafaela Meneses Farini', 'Coordenador', NULL, '12387', '857.991.335-79'),
      ('Anderson Vinicius de Jesus Pereira', 'Administrativo', 'Administrativo', '17954', '058.311.595-07'),
      ('Andreia Conceicao Almeida Rosendo dos Santos', 'Técnico de Enfermagem', NULL, '1119', '785.537.175-34'),
      ('Andreia Silva de Lima', 'Técnico de Enfermagem', NULL, '17829', '024.077.395-07'),
      ('Andreza Miranda Freitas Marques', 'Administrativo', 'Administrativo', '17955', '073.940.285-42'),
      ('Barbara Santos de Souza', 'Técnico de Enfermagem', NULL, '12335', '063.759.915-28'),
      ('Briana Carla Jesus de Lima', 'Técnico de Enfermagem', NULL, '1135', '018.890.185-03'),
      ('Bruno Gomes Cerqueira e Silva', 'Técnico de Enfermagem', NULL, '129596', '849.190.605-30'),
      ('Camila Magalhaes de Jesus Santos', 'Enfermeiro', NULL, '12898', '030.709.015-90'),
      ('Camila Nossa Muniz Moreira', 'Coordenador', 'Fisioterapia', '17808', '024.120.695-22'),
      ('Camila Santos Pascoal', 'Enfermeiro', NULL, '12750', '057.850.105-85'),
      ('Camila Souza Guimaraes', 'Fisioterapeuta', 'Fisioterapia', '1133', '071.802.955-07'),
      ('Care Caroline Santos Soares', 'Coordenador', 'Faturamento', '17815', '047.536.735-96'),
      ('Carla Eduarda Santos da Costa Vargens', 'Gerente', 'Administrativo/Financeiro', '11867', '028.437.275-70'),
      ('Carollane Meireles do Monte', 'Psicologia', 'Psicologia', '11452', '074.653.625-98'),
      ('Cerineide da Silva Oliveira de Oliveira', 'Atendente de Farmácia', 'Farmácia', '179950', '894.960.945-20'),
      ('Claucimene Piagio Cerqueira', 'Técnico de Enfermagem', NULL, '6991', '959.534.935-68'),
      ('Cremilda Santana Lima Costa', 'Supervisor', 'SAME', '17810', '224.683.228-43'),
      ('Daiane dos Anjos Rodrigues', 'Técnico de Enfermagem', NULL, '17859', '063.226.315-60'),
      ('Daise Viana Costa Andrade', 'Enfermeiro', NULL, '17358', '812.863.255-87'),
      ('Daniela Andrade Moutinho Montenegro', 'Enfermeiro', NULL, '17889', '788.999.235-15'),
      ('Daniela Cerqueira Santos', 'Técnico de Enfermagem', NULL, '1182', '815.838.265-72'),
      ('Daniela Pinheiro dos Santos', 'Enfermeiro', NULL, '17828', '822.186.685-72'),
      ('Daniele Bizarria Ribeiro', 'Supervisor', 'SIAST', '17845', '032.775.445-16'),
      ('Danielle Aparecida Brito de Souza', 'Enfermeiro', NULL, '17841', '332.005.188-12'),
      ('Debora da Silva Mendonca', 'Técnico de Enfermagem', NULL, '12840', '034.425.337-67'),
      ('Debora Pereira dos Santos', 'Administrativo', 'Administrativo', '6987', '019.148.355-90'),
      ('Debora Santos de Oliveira', 'Administrativo', 'Administrativo', '17396', '038.644.315-73'),
      ('Deisyane da Paz Duplat', 'Administrativo', 'Administrativo', '1137', '025.775.665-57'),
      ('Deivid Silva de Araujo Esquivel', 'Fisioterapeuta', 'Fisioterapia', '17914', '022.742.515-41'),
      ('Deivson Nunes Ventura', 'Coordenador', NULL, '17807', '039.044.175-92'),
      ('Denise de Figueredo Souza', 'Enfermeiro', NULL, '17884', '808.305.365-15'),
      ('Doralice Silva Neta', 'Técnico de Enfermagem', NULL, '12793', '705.313.745-72'),
      ('Doroteia Ferraz Misseno Santana', 'Nutricionista', NULL, '17910', '467.153.045-72'),
      ('Elaine Cristina Chagas Moreira Villas Boas', 'Enfermeiro', NULL, '17110', '784.253.445-49'),
      ('Eliane Reis dos Santos', 'Técnico de Enfermagem', NULL, '17835', '809.951.365-72'),
      ('Elisangela Xavier dos Santos Sodre', 'Fisioterapeuta', 'Fisioterapia', '6990', '989.495.005-15'),
      ('Emerson Silva Filho', 'Técnico de Enfermagem', NULL, '1190', '858.763.835-11'),
      ('Eneida Pinheiro Ongaratto', 'Fisioterapeuta', 'Fisioterapia', '17908', '581.875.705-63'),
      ('Erica Ferreira Mendonca Bazilio', 'Técnico de Enfermagem', NULL, '1121', '969.876.265-53'),
      ('Erica Vinhas Macedo Magalhaes', 'Fisioterapeuta', 'Fisioterapia', '1127', '611.804.595-04'),
      ('Flavia Madalena de Oliveira Cruz', 'Atendente de Farmácia', 'Farmácia', '17195', '032.410.955-50'),
      ('Flavio Santos Souza', 'Técnico de Enfermagem', NULL, '17862', '036.291.595-40'),
      ('Gabriel Florenilson de Souza Sacramento', 'Administrativo', 'Administrativo', '12393', '088.922.485-45'),
      ('Gabriela Beatriz Ribeiro Machado do Prado', 'Administrativo', 'Administrativo', '1194', '070.050.235-10'),
      ('Gabriela Quirino Belo', 'Fisioterapeuta', 'Fisioterapia', '1136', '858.744.785-82'),
      ('Gabriela Soares Viana Silveira', 'Enfermeiro', NULL, '1178', '031.569.435-17'),
      ('Gilvan de Jesus Silva', 'Técnico de Enfermagem', NULL, '1124', '576.579.715-68'),
      ('Glecia Gomes Rosa', 'Técnico de Enfermagem', NULL, '1181', '579.744.035-00'),
      ('Harlen Santos de Meneses', 'Administrativo', 'Administrativo', '12581', '702.176.535-53'),
      ('Helio Santos Sales', 'Técnico de Enfermagem', NULL, '17142', '767.828.405-53'),
      ('Hendia Silva Santos', 'Enfermeiro', NULL, '17877', '028.043.825-75'),
      ('Ione dos Santos Lima', 'Enfermeiro', NULL, '17888', '817.970.955-87'),
      ('Irlene Maria Dias da Conceicao', 'Técnico de Enfermagem', NULL, '1126', '002.578.375-07'),
      ('Isabela Lomba Paranhos', 'Fisioterapeuta', 'Fisioterapia', '17887', '856.177.415-00'),
      ('Isis Thaiane Mattos Rocha Pita', 'Enfermeiro', NULL, '17834', '022.530.415-56'),
      ('Jean Claudio Lourenco Alves', 'Atendente de Farmácia', 'Farmácia', '17891', '870.095.875-15'),
      ('Jessica Salmeiro Gomes Barreto', 'Cirurgiã Dentista', 'Odontologia', '17940', '055.258.805-98'),
      ('Jocelia Alcantara Pereira', 'Atendente de Farmácia', 'Farmácia', '17885', '015.255.165-40'),
      ('Joelma Mendes das Montanhas', 'Técnico de Enfermagem', NULL, '1186', '001.283.245-62'),
      ('Juciara de Oliveira Nunes', 'Técnico de Enfermagem', NULL, '1188', '968.030.885-53'),
      ('Judite Silva Santos', 'Enfermeiro', NULL, '17854', '022.929.385-96'),
      ('Juliana Barbosa Conceicao', 'Psicologia', 'Psicologia', '17928', '045.933.025-01'),
      ('Juliana Freitas Silva', 'Técnico de Enfermagem', NULL, '1185', '933.772.745-53'),
      ('Juliana Lima Alexandre Monteiro', 'Fisioterapeuta', 'Fisioterapia', '17913', '064.736.985-07'),
      ('Juliana Lima Guerra', 'Administrativo', 'Administrativo', '123100', '019.341.795-23'),
      ('Juliana Oliveira Ramos', 'Técnico de Enfermagem', NULL, '1184', '052.671.665-70'),
      ('Juliana Rios de Araujo e Araujo', 'Enfermeiro', NULL, '17842', '011.558.435-84'),
      ('Laiane Lopes da Cruz', 'Coordenador', 'NSP', '17906', '018.661.445-45'),
      ('Lais Cardoso dos Anjos', 'Coordenador', 'Farmácia', '17881', '056.189.725-57'),
      ('Laisa Menezes Galrao', 'Administrativo', NULL, '12354', '044.203.205-67'),
      ('Lara dos Santos Queiroz Alves', 'Administrativo', 'Administrativo', '1138', '069.907.755-99'),
      ('Laura Braga de Jesus', 'Fonoaudiólogo', NULL, '6993', '025.550.845-09'),
      ('Leila Maria Cintra da Cunha Sampaio Oliveira', 'Fisioterapeuta', 'Fisioterapia', '17890', '765.915.905-44'),
      ('Leila Sacramento de Andrade Amorim Fraga', 'Enfermeiro', NULL, '17868', '796.227.475-15'),
      ('Liane Rego Caribe Ramos', 'Fisioterapeuta', 'Fisioterapia', '17118', '959.201.615-15'),
      ('Liliam Raquel de Almeida Azevedo', 'Coordenador', 'NIR', '17806', '861.753.895-30'),
      ('Lilian Flores Araujo', 'Técnico de Enfermagem', NULL, '1694', '787.614.505-10'),
      ('Lucas Monte Karam', 'Diretor', NULL, '17805', '859.861.225-18'),
      ('Luciana Almeida dos Santos', 'Fisioterapeuta', 'Fisioterapia', '17929', '616.460.835-04'),
      ('Luciano Hayne Mettig', 'Fisioterapeuta', 'Fisioterapia', '6989', '814.555.005-00'),
      ('Lucineia dos Santos Andrade', 'Enfermeiro', NULL, '17870', '057.785.245-01'),
      ('Lucivalda Ferreira Lima', 'Enfermeiro', NULL, '17879', '921.430.085-20'),
      ('Maiara da Silva Santos', 'Enfermeiro', NULL, '17865', '025.999.945-86'),
      ('Manoel Ivaldo de Faro Sobral Junior', 'Administrativo', 'Administrativo', '11198', '873.885.965-34'),
      ('Manuela Silva Costa', 'Fisioterapeuta', 'Fisioterapia', '17923', '800.612.305-53'),
      ('Maria Claudia Lopes da Silva', 'Técnico de Enfermagem', NULL, '12978', '827.901.835-20'),
      ('Maria Cristina Meneses Cerqueira', 'Supervisor', 'Faturamento', '17813', '564.541.395-49'),
      ('Maria das Virgens Souza dos Santos', 'Técnico de Enfermagem', NULL, '11101', '007.948.425-50'),
      ('Maria Del Carmen Moleiro Alves', 'Diretor', NULL, '17848', '359.001.995-68'),
      ('Maria do Carmo dos Santos Vieira', 'Auxiliar de Odontologia', 'Odontologia', '17935', '487.347.305-59'),
      ('Maria Duke de Cerqueira', 'Técnico de Enfermagem', NULL, '12496', '790.713.845-00'),
      ('Maria Luiza Batista Adorno', 'Supervisor', 'Ouvidoria', '17809', '087.819.485-14'),
      ('Marilia Pena Silva', 'Psicologia', 'Psicologia', '17915', '389.819.395-00'),
      ('Marli de Assis Santos Bispo', 'Atendente de Farmácia', 'Farmácia', '17920', '007.758.895-98'),
      ('Michele Coelho Serra Gama', 'Fisioterapeuta', 'Fisioterapia', '17909', '914.590.795-15'),
      ('Michele Costa Salgueiro', 'Enfermeiro', NULL, '17942', '826.375.125-04'),
      ('Milena Borges Pereira', 'Coordenador', 'Hotelaria/Higienização', '17804', '020.777.915-51'),
      ('Milena Izabel Ribeiro Freitas', 'Técnico de Enfermagem', NULL, '17831', '859.372.295-41'),
      ('Milena Machado Cerqueira', 'Enfermeiro', NULL, '17486', '033.219.295-46'),
      ('Miucha Mara Cerqueira Silva', 'Técnico de Enfermagem', NULL, '1196', '367.148.908-18'),
      ('Monica das Virgens de Jesus', 'Técnico de Enfermagem', NULL, '11100', '040.844.445-29'),
      ('Naiara Keli Lima dos Santos', 'Técnico de Enfermagem', NULL, '17819', '861.521.355-08'),
      ('Natacha Santos Avelino da Silva', 'Técnico de Enfermagem', NULL, '11863', '068.896.535-05'),
      ('Nilma dos Santos', 'Técnico de Enfermagem', NULL, '1235', '670.528.005-00'),
      ('Nivalda Santos Pereira', 'Técnico de Enfermagem', NULL, '1298', '183.723.505-82'),
      ('Paloma da Silva Firpo', 'Fisioterapeuta', 'Fisioterapia', '6999', '013.302.395-80'),
      ('Patricia de Araujo Ferreira', 'Técnico de Enfermagem', NULL, '129587', '678.485.325-34'),
      ('Pedro Paulo Silva de Assis Junior', 'Farmacêutico', 'Farmácia', '12385', '049.252.735-07'),
      ('Pollyanna Souza Miranda', 'Assistente Social', 'Serviço Social', '17948', '009.822.925-70'),
      ('Rafael Jorge Oliveira dos Santos', 'Administrativo', NULL, '1289', '088.353.885-70'),
      ('Rafaela Assis dos Santos', 'Supervisor', 'Almoxarifado', '17811', '862.043.715-17'),
      ('Raiane Santos Lima', 'Fisioterapeuta', 'Fisioterapia', '1132', '068.162.475-23'),
      ('Regina Gonzaga dos Santos', 'Técnico de Enfermagem', NULL, '17186', '781.364.905-20'),
      ('Reinan Vitorio de Freitas', 'Técnico de Informática', NULL, '6988', '047.485.455-85'),
      ('Renata da Costa Lima de Araujo', 'Técnico de Enfermagem', NULL, '11103', '005.882.125-20'),
      ('Renata Figueiredo de Almeida Fernandes', 'Enfermeiro', NULL, '12744', '045.574.635-41'),
      ('Renilton de Jesus Oliveira', 'Atendente de Farmácia', 'Farmácia', '17907', '894.059.275-15'),
      ('Rizia de Melo Mendes', 'Enfermeiro', NULL, '17882', '843.467.285-53'),
      ('Rodrigo Almeida Aquino', 'Técnico de Enfermagem', NULL, '17136', '038.537.165-98'),
      ('Rodrigo Teixeira Sousa', 'Administrativo', 'Faturamento', '17816', '866.866.295-37'),
      ('Rosana Maria de Assis Nunes', 'Técnico de Enfermagem', NULL, '17873', '419.423.105-87'),
      ('Rosangela dos Santos Nascimento da Silva', 'Fisioterapeuta', 'Fisioterapia', '12138', '035.486.115-83'),
      ('Roselia Delgado das Chagas', 'Farmacêutico', 'Farmácia', '17938', '379.871.355-34'),
      ('Roseni Maria Silva dos Santos', 'Administrativo', 'Administrativo', '1189', '539.851.925-53'),
      ('Roseni Muniz Franca', 'Nutricionista', NULL, '17893', '791.736.915-34'),
      ('Rosilene Lage de Almeida', 'Técnico de Enfermagem', NULL, '11102', '508.502.455-91'),
      ('Rosineide Loreto de Jesus', 'Fisioterapeuta', 'Fisioterapia', '170212', '812.568.505-78'),
      ('Sandra Regines Paixao dos Reis', 'Coordenador', 'Serviço Social', '17930', '651.431.325-68'),
      ('Silene Maria dos Santos', 'Técnico de Enfermagem', NULL, '17875', '487.573.305-49'),
      ('Silvia Roberta Batista dos Santos', 'Técnico de Enfermagem', NULL, '12839', '685.542.905-00'),
      ('Simara Neto Ferreira', 'Farmacêutico', 'Farmácia', '1297', '033.889.425-01'),
      ('Solon Silva Mutti', 'Administrativo', 'Administrativo', '17952', '943.434.545-68'),
      ('Stefani Lima de Sousa Silva Maia', 'Técnico de Enfermagem', NULL, '1142', '039.159.545-86'),
      ('Suelen Fernandes Figueiredo Mota', 'Nutricionista', NULL, '12779', '040.483.105-26'),
      ('Suzana Guimaraes Nunes', 'Técnico de Enfermagem', NULL, '1125', '933.044.555-15'),
      ('Taina Barbara de Jesus Trigueiros Sa', 'Técnico de Enfermagem', NULL, '12348', '860.315.495-30'),
      ('Tais Conceicao Damasceno', 'Fisioterapeuta', 'Fisioterapia', '17894', '042.551.375-01'),
      ('Tatiana Pereira Said', 'Técnico de Enfermagem', NULL, '12856', '786.934.114-20'),
      ('Tatiane Conceicao Santos', 'Técnico de Enfermagem', NULL, '12875', '067.031.035-26'),
      ('Tatiane Santos da Silva', 'Técnico de Enfermagem', NULL, '17876', '032.634.215-06'),
      ('Telma Regina de Jesus do Monte', 'Técnico de Enfermagem', NULL, '17847', '494.763.435-91'),
      ('Thaina Barbosa Santana', 'Técnico de Enfermagem', NULL, '17147', '080.203.775-57'),
      ('Thaina Gomes dos Santos', 'Técnico de Enfermagem', NULL, '1139', '063.593.735-21'),
      ('Thais Menezes Dias', 'Enfermeiro', NULL, '17818', '806.376.555-91'),
      ('Uenderson de Jesus Santos', 'Atendente de Farmácia', 'Farmácia', '12386', '857.993.685-33'),
      ('Vanessa Santos Coelho', 'Técnico de Enfermagem', NULL, '17840', '019.168.455-41'),
      ('Vera Lucia Ferreira Barbosa', 'Enfermeiro', NULL, '17140', '353.973.225-04'),
      ('Vinicius dos Santos Lima', 'Gerente', 'Administrativo/Financeiro', '17223', '015.593.645-05'),
      ('Virginia Maria dos Santos', 'Enfermeiro', NULL, '1179', '515.022.835-49'),
      ('Vivian Cristina Copque de Araujo', 'Enfermeiro', NULL, '1238', '031.816.495-70'),
      ('Vivian Keila Campos Abreu', 'Atendente de Farmácia', 'Farmácia', '17925', '887.320.295-00'),
      ('Viviane de Jesus Ferreira Souza', 'Técnico de Enfermagem', NULL, '17866', '045.515.205-51'),
      ('Viviani Teixeira de Jesus', 'Técnico de Enfermagem', NULL, '17832', '841.133.245-49'),
      ('Wagner Ferreira Figueredo', 'Fisioterapeuta', 'Fisioterapia', '17450', '019.235.355-10'),
      ('Wellington Evangelista dos Santos', 'Técnico de Enfermagem', NULL, '1183', '912.910.895-00')
    ) AS t(full_name, category_name, department_name, registration_number, cpf)
  ) LOOP
    -- Pular se já existe profissional com mesmo CPF (exceto CPF genérico)
    IF prof.cpf != '000.000.000-00' AND EXISTS (
      SELECT 1 FROM professionals WHERE cpf = prof.cpf
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    -- Pular se já existe profissional com mesmo nome E mesma matrícula
    IF prof.registration_number IS NOT NULL AND EXISTS (
      SELECT 1 FROM professionals
      WHERE full_name = prof.full_name
      AND registration_number = prof.registration_number
    ) THEN
      skipped_count := skipped_count + 1;
      CONTINUE;
    END IF;

    INSERT INTO professionals (
      full_name, category_id, department_id, registration_number,
      cpf, active, company_id, establishment_id, contracted_hours_per_month
    )
    VALUES (
      prof.full_name,
      (SELECT id FROM professional_categories WHERE name = prof.category_name LIMIT 1),
      (SELECT id FROM departments WHERE name = prof.department_name LIMIT 1),
      prof.registration_number,
      prof.cpf,
      true,
      default_company_id,
      default_establishment_id,
      180
    );

    inserted_count := inserted_count + 1;
  END LOOP;

  RAISE NOTICE 'Profissionais inseridos: %. Ignorados (já existiam): %.', inserted_count, skipped_count;
END $$;
