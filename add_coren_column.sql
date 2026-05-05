-- =============================================================================
-- Adiciona coluna COREN à tabela professionals
-- - text (livre): pode incluir prefixo "COREN-BA" ou só números
-- - índice para buscas rápidas
-- - idempotente (IF NOT EXISTS)
-- =============================================================================

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS coren text;

CREATE INDEX IF NOT EXISTS idx_professionals_coren
  ON professionals (coren)
  WHERE coren IS NOT NULL;

COMMENT ON COLUMN professionals.coren IS
  'Número de inscrição no COREN (Conselho Regional de Enfermagem). Aplicável a Enfermeiros e Técnicos de Enfermagem.';

-- Verificação
SELECT
  column_name,
  data_type,
  is_nullable,
  col_description('professionals'::regclass, ordinal_position) AS comentario
FROM information_schema.columns
WHERE table_name = 'professionals'
  AND column_name = 'coren';
