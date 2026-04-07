/*
  # Adicionar Tabela de Escalas Mensais Consolidadas

  1. Nova Tabela
    - `monthly_schedules` - Escalas mensais consolidadas
      - `id` (uuid, primary key)
      - `department_id` (uuid, foreign key) - Departamento
      - `month` (date) - Mês/Ano da escala (primeiro dia do mês)
      - `name` (text) - Nome descritivo da escala
      - `status` (text) - Rascunho, Publicada, Fechada
      - `created_by` (uuid, foreign key to auth.users)
      - `published_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modificações
    - Adicionar coluna `schedule_id` na tabela `shifts` para vincular ao cronograma mensal

  3. Segurança
    - RLS habilitado
    - Políticas para usuários autenticados

  4. Índices
    - Índice composto em (department_id, month) para busca rápida
*/

-- Criar tabela de escalas mensais
CREATE TABLE IF NOT EXISTS monthly_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  month date NOT NULL,
  name text NOT NULL,
  status text DEFAULT 'Rascunho' CHECK (status IN ('Rascunho', 'Publicada', 'Fechada')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(department_id, month)
);

-- Adicionar coluna schedule_id na tabela shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shifts' AND column_name = 'schedule_id'
  ) THEN
    ALTER TABLE shifts ADD COLUMN schedule_id uuid REFERENCES monthly_schedules(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_monthly_schedules_dept_month ON monthly_schedules(department_id, month);
CREATE INDEX IF NOT EXISTS idx_shifts_schedule_id ON shifts(schedule_id);

-- Habilitar RLS
ALTER TABLE monthly_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view monthly schedules"
  ON monthly_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create monthly schedules"
  ON monthly_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update monthly schedules"
  ON monthly_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete monthly schedules"
  ON monthly_schedules FOR DELETE
  TO authenticated
  USING (true);
