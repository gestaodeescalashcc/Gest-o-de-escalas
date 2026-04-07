/*
  # Add PIS Number and Hire Date to Professionals

  1. New Columns
    - `professionals.pis_number` (text, nullable) - PIS/PASEP number for fiscal exports
    - `professionals.hire_date` (date, nullable) - Employment start date for AEJ exports

  2. Purpose
    - These fields are required for AFD and AEJ fiscal export compliance
    - PIS is used in worker identification records
    - Hire date is required in AEJ Type 2 records
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professionals' AND column_name = 'pis_number'
  ) THEN
    ALTER TABLE professionals ADD COLUMN pis_number text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professionals' AND column_name = 'hire_date'
  ) THEN
    ALTER TABLE professionals ADD COLUMN hire_date date;
  END IF;
END $$;

COMMENT ON COLUMN professionals.pis_number IS 'Numero PIS/PASEP do trabalhador para exportacoes fiscais';
COMMENT ON COLUMN professionals.hire_date IS 'Data de admissao do trabalhador para AEJ';