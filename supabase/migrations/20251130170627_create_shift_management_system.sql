/*
  # Sistema de Gestão de Escalas e Plantões

  ## 1. Novas Tabelas
  
  ### departments - Departamentos/Setores
    - id (uuid, primary key)
    - name (text) - Nome do departamento
    - description (text) - Descrição
    - created_at (timestamptz)
  
  ### professional_categories - Categorias Profissionais
    - id (uuid, primary key)
    - name (text) - Maqueiro, Enfermeiro, Médico, etc.
    - color (text) - Cor para identificação visual
    - created_at (timestamptz)
  
  ### professionals - Profissionais
    - id (uuid, primary key)
    - user_id (uuid, foreign key to auth.users)
    - full_name (text)
    - category_id (uuid, foreign key)
    - department_id (uuid, foreign key)
    - registration_number (text) - Matrícula/Registro profissional
    - phone (text)
    - email (text)
    - active (boolean)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  ### shifts - Escalas/Plantões
    - id (uuid, primary key)
    - professional_id (uuid, foreign key)
    - department_id (uuid, foreign key)
    - shift_date (date)
    - start_time (time)
    - end_time (time)
    - shift_type (text) - Manhã, Tarde, Noite, 24h
    - status (text) - Agendado, Em andamento, Concluído, Cancelado
    - notes (text)
    - created_by (uuid, foreign key to auth.users)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  ### shift_swaps - Trocas de Plantões
    - id (uuid, primary key)
    - original_shift_id (uuid, foreign key)
    - requesting_professional_id (uuid, foreign key)
    - target_professional_id (uuid, foreign key)
    - offered_shift_id (uuid, foreign key, nullable)
    - reason (text)
    - status (text) - Pendente, Aprovado, Recusado, Cancelado
    - requested_at (timestamptz)
    - responded_at (timestamptz, nullable)
    - approved_by (uuid, foreign key to auth.users, nullable)
    - approved_at (timestamptz, nullable)
    - notes (text)
    - created_at (timestamptz)
    - updated_at (timestamptz)
  
  ### shift_history - Histórico de Alterações
    - id (uuid, primary key)
    - shift_id (uuid, foreign key)
    - action_type (text) - Criado, Modificado, Trocado, Cancelado
    - performed_by (uuid, foreign key to auth.users)
    - details (jsonb)
    - created_at (timestamptz)

  ## 2. Segurança
    - RLS habilitado em todas as tabelas
    - Usuários autenticados podem visualizar e gerenciar dados
*/

CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professional_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  category_id uuid REFERENCES professional_categories(id) ON DELETE RESTRICT,
  department_id uuid REFERENCES departments(id) ON DELETE RESTRICT,
  registration_number text,
  phone text,
  email text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE RESTRICT,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  shift_type text NOT NULL,
  status text DEFAULT 'Agendado',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_swaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_shift_id uuid REFERENCES shifts(id) ON DELETE CASCADE,
  requesting_professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  target_professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  offered_shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  reason text NOT NULL,
  status text DEFAULT 'Pendente',
  requested_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES shifts(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  performed_by uuid REFERENCES auth.users(id),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_professionals_user_id ON professionals(user_id);
CREATE INDEX IF NOT EXISTS idx_professionals_category ON professionals(category_id);
CREATE INDEX IF NOT EXISTS idx_professionals_department ON professionals(department_id);
CREATE INDEX IF NOT EXISTS idx_shifts_professional ON shifts(professional_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_department ON shifts(department_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swaps(status);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_requesting ON shift_swaps(requesting_professional_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_target ON shift_swaps(target_professional_id);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver departamentos"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar departamentos"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar departamentos"
  ON departments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ver categorias"
  ON professional_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar categorias"
  ON professional_categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ver profissionais"
  ON professionals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar profissionais"
  ON professionals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar profissionais"
  ON professionals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ver plantões"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar plantões"
  ON shifts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar plantões"
  ON shifts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar plantões"
  ON shifts FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem ver trocas"
  ON shift_swaps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar trocas"
  ON shift_swaps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar trocas"
  ON shift_swaps FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ver histórico"
  ON shift_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar histórico"
  ON shift_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO professional_categories (name, color) VALUES
  ('Maqueiro', '#10B981'),
  ('Enfermeiro', '#3B82F6'),
  ('Médico', '#EF4444'),
  ('Fisioterapeuta', '#8B5CF6'),
  ('Técnico de Radiologia', '#F59E0B'),
  ('Técnico de Enfermagem', '#06B6D4'),
  ('Vigilante', '#6B7280'),
  ('Técnico de Laboratório', '#EC4899'),
  ('Assistente Social', '#14B8A6'),
  ('Administrativo', '#F97316')
ON CONFLICT (name) DO NOTHING;
