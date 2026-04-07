/*
  # Adicionar Carga Horária Contratada aos Profissionais

  1. Alterações na Tabela `professionals`
    - Adiciona coluna `contracted_hours_per_month` (integer) - Carga horária mensal contratada
    - Valor padrão: 180 horas (comum para regime de 12x36 e administrativos)
    - Permite valores NULL para profissionais sem carga definida

  2. Notas Importantes
    - Campo usado para validar se a escala não excede a carga horária contratada
    - Exemplos comuns:
      * 180h/mês - Plantão 12x36 (15 plantões de 12h)
      * 120h/mês - Administrativo 30h/semana
      * 200h/mês - Administrativo 40h/semana + extras
      * 240h/mês - Plantão 24x48 (10 plantões de 24h)
*/

-- Adiciona coluna de carga horária mensal contratada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professionals' AND column_name = 'contracted_hours_per_month'
  ) THEN
    ALTER TABLE professionals ADD COLUMN contracted_hours_per_month integer DEFAULT 180;
  END IF;
END $$;

-- Comentário na coluna para documentação
COMMENT ON COLUMN professionals.contracted_hours_per_month IS 'Carga horária mensal contratada em horas. Usado para validar limites de escala.';
