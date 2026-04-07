/*
  # Add CPF field to professionals table
  
  1. Changes
    - Add `cpf` column to professionals table (required for AFD)
    - CPF is the official Brazilian individual taxpayer registry number
    - This is separate from registration_number which is the internal employee ID
    
  2. Purpose
    - Required for AFD (Arquivo Fonte de Dados) compliance with Portaria MTP 671/2021
    - Campo 4 of AFD tipo 7 requires the CPF of the employee (12 digits)
    - Campo 2 of AFD tipo 2 requires the CPF for employee identification
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'professionals' AND column_name = 'cpf'
  ) THEN
    ALTER TABLE professionals ADD COLUMN cpf TEXT;
  END IF;
END $$;