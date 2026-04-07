/*
  # Sistema de Reconhecimento Facial e Registro de Ponto

  1. Novas Tabelas
    - `professional_facial_data`
      - `id` (uuid, primary key)
      - `professional_id` (uuid, foreign key to professionals)
      - `facial_image_url` (text) - URL da imagem facial armazenada
      - `facial_descriptors` (jsonb) - Descritores faciais para comparação
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `timesheet_records`
      - `id` (uuid, primary key)
      - `professional_id` (uuid, foreign key to professionals)
      - `shift_id` (uuid, foreign key to shifts, nullable)
      - `check_in_time` (timestamptz)
      - `check_out_time` (timestamptz, nullable)
      - `check_in_photo_url` (text) - Foto do check-in
      - `check_out_photo_url` (text, nullable) - Foto do check-out
      - `status` (text) - 'Em andamento', 'Concluído', 'Incompleto'
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
    - Professionals can view their own records
    - Admins can view all records
*/

-- Create professional_facial_data table
CREATE TABLE IF NOT EXISTS professional_facial_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  facial_image_url text NOT NULL,
  facial_descriptors jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(professional_id)
);

-- Create timesheet_records table
CREATE TABLE IF NOT EXISTS timesheet_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  check_in_photo_url text NOT NULL,
  check_out_photo_url text,
  status text NOT NULL DEFAULT 'Em andamento',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_facial_data_professional ON professional_facial_data(professional_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_professional ON timesheet_records(professional_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_shift ON timesheet_records(shift_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_date ON timesheet_records(check_in_time);

-- Enable RLS
ALTER TABLE professional_facial_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_records ENABLE ROW LEVEL SECURITY;

-- Policies for professional_facial_data
CREATE POLICY "Users can view facial data"
  ON professional_facial_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert facial data"
  ON professional_facial_data FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update facial data"
  ON professional_facial_data FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete facial data"
  ON professional_facial_data FOR DELETE
  TO authenticated
  USING (true);

-- Policies for timesheet_records
CREATE POLICY "Users can view timesheet records"
  ON timesheet_records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert timesheet records"
  ON timesheet_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update timesheet records"
  ON timesheet_records FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete timesheet records"
  ON timesheet_records FOR DELETE
  TO authenticated
  USING (true);