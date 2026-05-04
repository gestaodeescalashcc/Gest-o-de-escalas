-- =============================================================================
-- RESTRINGIR COORDENADORES AOS SEUS SETORES (allowed_departments)
--
-- Cria setor "Nutrição" se não existir e vincula cada coordenador
-- ao(s) setor(es) que ele coordena.
-- =============================================================================

-- 1. Garantir que o setor Nutrição existe (para o Deivson)
INSERT INTO departments (name, description, active)
SELECT 'Nutrição', 'Equipe de Nutrição Hospitalar', true
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Nutrição');

DO $$
DECLARE
  -- Setores
  d_enfermeiros uuid;
  d_tec_enf uuid;
  d_cme uuid;
  d_faturamento uuid;
  d_nutricao uuid;
  d_farmacia uuid;
  d_caf uuid;
  d_hotelaria_hig uuid;
  d_servico_social uuid;
  d_nir uuid;
  d_nsp uuid;
  d_fisioterapia uuid;
  d_scih uuid;
BEGIN
  -- Pegar IDs dos setores
  SELECT id INTO d_enfermeiros FROM departments WHERE name = 'Enfermeiros';
  SELECT id INTO d_tec_enf FROM departments WHERE name = 'Técnicos de Enfermagem';
  SELECT id INTO d_cme FROM departments WHERE name = 'Técnicos de Enfermagem CME';
  SELECT id INTO d_faturamento FROM departments WHERE name = 'Faturamento';
  SELECT id INTO d_nutricao FROM departments WHERE name = 'Nutrição';
  SELECT id INTO d_farmacia FROM departments WHERE name = 'Farmácia';
  SELECT id INTO d_caf FROM departments WHERE name = 'CAF';
  SELECT id INTO d_hotelaria_hig FROM departments WHERE name = 'Hotelaria/Higienização';
  SELECT id INTO d_servico_social FROM departments WHERE name = 'Serviço Social';
  SELECT id INTO d_nir FROM departments WHERE name = 'NIR';
  SELECT id INTO d_nsp FROM departments WHERE name = 'NSP';
  SELECT id INTO d_fisioterapia FROM departments WHERE name = 'Fisioterapia';
  SELECT id INTO d_scih FROM departments WHERE name = 'SCIH';

  -- =====================================================
  -- COORDENADORES NOVOS (criados na migration de Abril)
  -- =====================================================

  -- Ana Rafaela Meneses Farini → Coord. Enfermagem (Enfermeiros + Técnicos + CME)
  UPDATE system_users
  SET allowed_departments = ARRAY[d_enfermeiros, d_tec_enf, d_cme]
  WHERE email = 'anafarini@fesfsus.ba.gov.br';

  -- Care Caroline Santos Soares → Faturamento
  UPDATE system_users
  SET allowed_departments = ARRAY[d_faturamento]
  WHERE email = 'caresoares@fesfsus.ba.gov.br';

  -- Deivson Nunes Ventura → Nutrição
  UPDATE system_users
  SET allowed_departments = ARRAY[d_nutricao]
  WHERE email = 'deivsonventura@fesfsus.ba.gov.br';

  -- Lais Cardoso dos Anjos → Farmácia + CAF
  UPDATE system_users
  SET allowed_departments = ARRAY[d_farmacia, d_caf]
  WHERE email = 'laisestrela@fesfsus.ba.gov.br';

  -- Milena Borges Pereira → Hotelaria/Higienização
  UPDATE system_users
  SET allowed_departments = ARRAY[d_hotelaria_hig]
  WHERE email = 'Milenapereira@fesfsus.ba.gov.br';

  -- Sandra Regines Paixao dos Reis → Serviço Social
  UPDATE system_users
  SET allowed_departments = ARRAY[d_servico_social]
  WHERE email = 'Sandraregines@fesfsus.ba.gov.br';

  -- =====================================================
  -- COORDENADORES JÁ EXISTENTES (corrigir/manter)
  -- =====================================================

  -- Liliam Raquel → NIR (já está, mas garantir)
  UPDATE system_users
  SET allowed_departments = ARRAY[d_nir]
  WHERE email = 'liliamraquel@fesfsus.ba.gov.br';

  -- Laiane Lopes da Cruz → Coord. Segurança do Paciente (NSP) — corrigir!
  UPDATE system_users
  SET allowed_departments = ARRAY[d_nsp]
  WHERE email = 'laianecruz@fesfsus.ba.gov.br';

  -- Camila Nossa Muniz Moreira → Fisioterapia
  UPDATE system_users
  SET allowed_departments = ARRAY[d_fisioterapia]
  WHERE email = 'camilanossa@fesfsus.ba.gov.br';

  -- Aline Mendes Cruz Sena → Serv Controle Infecção (SCIH)
  UPDATE system_users
  SET allowed_departments = ARRAY[d_scih]
  WHERE email = 'alinesena@fesfsus.ba.gov.br';

  RAISE NOTICE 'Coordenadores restringidos aos seus setores com sucesso.';
END $$;

-- Verificação
SELECT
  su.email,
  su.full_name,
  ur.name AS role,
  array_length(su.allowed_departments, 1) AS qtd_setores,
  (
    SELECT string_agg(d.name, ', ' ORDER BY d.name)
    FROM departments d
    WHERE d.id = ANY(su.allowed_departments)
  ) AS setores
FROM system_users su
JOIN user_roles ur ON ur.id = su.role_id
WHERE ur.name = 'Coordenador'
ORDER BY su.full_name;
