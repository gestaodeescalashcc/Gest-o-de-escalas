-- =============================================================================
-- OCULTAR (soft delete) os 3 postos antigos de Enfermaria
--
-- Estratégia:
-- 1. Adiciona coluna `active` na tabela departments (default true)
-- 2. Marca os 3 postos antigos como active=false
-- 3. Frontend deve filtrar active=true ao listar setores em selects de criação
-- =============================================================================

-- 1. Adicionar coluna `active` (idempotente)
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2. Marcar os 3 postos como inativos
UPDATE departments
SET active = false
WHERE name IN ('Enfermarias Posto 1', 'Enfermaria Posto 2', 'Enfermaria Posto 3');

-- 3. Verificação
SELECT name, active
FROM departments
WHERE name IN ('Enfermarias Posto 1', 'Enfermaria Posto 2', 'Enfermaria Posto 3')
   OR name IN ('Enfermeiros', 'Técnicos de Enfermagem', 'Técnicos de Enfermagem CME')
ORDER BY active DESC, name;
