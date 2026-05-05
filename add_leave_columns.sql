-- =============================================================================
-- Adiciona colunas para marcar profissionais afastados (mas recebendo salário)
-- - on_leave: boolean (default false)
-- - leave_reason: text livre (motivo, ex: "Auxílio doença")
-- - leave_started_at: data de início do afastamento (opcional)
-- =============================================================================

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS on_leave boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leave_reason text,
  ADD COLUMN IF NOT EXISTS leave_started_at date;

COMMENT ON COLUMN professionals.on_leave IS
  'Marca profissionais afastados que continuam recebendo (auxílio doença, licença maternidade, etc.). Não aparecem na grade da escala mas seguem listados em rodapé.';

CREATE INDEX IF NOT EXISTS idx_professionals_on_leave
  ON professionals(on_leave) WHERE on_leave = true;

-- Verificação
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'professionals'
  AND column_name IN ('on_leave', 'leave_reason', 'leave_started_at')
ORDER BY column_name;
