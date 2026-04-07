/*
  # Adicionar Campos de Horário de Refeição

  1. Alterações na Tabela
    - `timesheet_records`
      - `meal_break_start` (timestamptz, nullable) - Horário de saída para refeição
      - `meal_break_end` (timestamptz, nullable) - Horário de retorno da refeição
      - `meal_break_start_photo_url` (text, nullable) - Foto da saída para refeição
      - `meal_break_end_photo_url` (text, nullable) - Foto do retorno da refeição

  2. Notas
    - Campos opcionais para permitir flexibilidade
    - Fotos para auditoria completa
    - Permite calcular tempo de refeição separadamente
*/

-- Adicionar campos de refeição
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_records' AND column_name = 'meal_break_start'
  ) THEN
    ALTER TABLE timesheet_records ADD COLUMN meal_break_start timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_records' AND column_name = 'meal_break_end'
  ) THEN
    ALTER TABLE timesheet_records ADD COLUMN meal_break_end timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_records' AND column_name = 'meal_break_start_photo_url'
  ) THEN
    ALTER TABLE timesheet_records ADD COLUMN meal_break_start_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'timesheet_records' AND column_name = 'meal_break_end_photo_url'
  ) THEN
    ALTER TABLE timesheet_records ADD COLUMN meal_break_end_photo_url text;
  END IF;
END $$;