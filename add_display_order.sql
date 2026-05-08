-- =============================================================================
-- Adiciona ordenação customizada de profissionais na escala
-- - display_order: int (menor = aparece antes)
-- - block_separator_after: boolean (renderiza linha em branco depois)
-- =============================================================================

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS display_order int,
  ADD COLUMN IF NOT EXISTS block_separator_after boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_professionals_display_order
  ON professionals(department_id, display_order)
  WHERE display_order IS NOT NULL;

COMMENT ON COLUMN professionals.display_order IS
  'Ordem custom dentro do setor. Menor = aparece antes. NULL = ordem alfabética.';
COMMENT ON COLUMN professionals.block_separator_after IS
  'Quando true, renderiza linha em branco/separador depois deste profissional.';
