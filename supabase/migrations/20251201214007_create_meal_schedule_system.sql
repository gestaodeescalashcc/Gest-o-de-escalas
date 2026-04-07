/*
  # Sistema de Escala de Refeições

  1. Nova Tabela - Configuração de Categorias com Direito a Refeição
    - `meal_category_config` - Define quais categorias têm direito a refeições
      - `id` (uuid, primary key)
      - `category_id` (uuid, foreign key) - Categoria profissional
      - `has_meal_benefit` (boolean) - Se tem direito a refeição
      - `notes` (text) - Observações
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Nova Tabela - Escala de Refeições Gerada
    - `meal_schedules` - Registro de quem tem direito a quais refeições por dia
      - `id` (uuid, primary key)
      - `shift_id` (uuid, foreign key) - Turno relacionado
      - `professional_id` (uuid, foreign key) - Profissional
      - `shift_date` (date) - Data do turno
      - `shift_type` (text) - Tipo de turno (para referência)
      - `shift_hours` (numeric) - Horas do turno
      - `has_breakfast` (boolean) - Direito a desjejum
      - `has_lunch` (boolean) - Direito a almoço
      - `has_dinner` (boolean) - Direito a jantar
      - `has_supper` (boolean) - Direito a ceia
      - `total_meals` (integer) - Total de refeições
      - `generated_at` (timestamptz) - Quando foi gerada
      - `created_by` (uuid, foreign key)

  3. Regras de Negócio (conforme HECC/FESF)
    - Jornada ≤ 6h: 0 refeições
    - Jornada 8h: 1 refeição (almoço)
    - Plantão 12h Diurno (SD): 1 refeição (almoço)
    - Plantão 12h Noturno (SN): 2 refeições (ceia + desjejum)
    - Plantão 24h: 4 refeições (almoço + jantar + ceia + desjejum)

  4. Segurança
    - RLS habilitado
    - Políticas para usuários autenticados
*/

-- Tabela de configuração de categorias com direito a refeição
CREATE TABLE IF NOT EXISTS meal_category_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES professional_categories(id) ON DELETE CASCADE NOT NULL,
  has_meal_benefit boolean DEFAULT false NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(category_id)
);

-- Tabela de escala de refeições
CREATE TABLE IF NOT EXISTS meal_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,
  shift_date date NOT NULL,
  shift_type text NOT NULL,
  shift_hours numeric(5,2) NOT NULL DEFAULT 0,
  has_breakfast boolean DEFAULT false,
  has_lunch boolean DEFAULT false,
  has_dinner boolean DEFAULT false,
  has_supper boolean DEFAULT false,
  total_meals integer DEFAULT 0,
  generated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(shift_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_meal_category_config_category ON meal_category_config(category_id);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_date ON meal_schedules(shift_date);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_professional ON meal_schedules(professional_id);
CREATE INDEX IF NOT EXISTS idx_meal_schedules_shift ON meal_schedules(shift_id);

-- Habilitar RLS
ALTER TABLE meal_category_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_schedules ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança para meal_category_config
CREATE POLICY "Users can view meal category config"
  ON meal_category_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create meal category config"
  ON meal_category_config FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update meal category config"
  ON meal_category_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete meal category config"
  ON meal_category_config FOR DELETE
  TO authenticated
  USING (true);

-- Políticas de segurança para meal_schedules
CREATE POLICY "Users can view meal schedules"
  ON meal_schedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create meal schedules"
  ON meal_schedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update meal schedules"
  ON meal_schedules FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete meal schedules"
  ON meal_schedules FOR DELETE
  TO authenticated
  USING (true);

-- Função para calcular automaticamente total_meals
CREATE OR REPLACE FUNCTION calculate_total_meals()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_meals := 
    (CASE WHEN NEW.has_breakfast THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.has_lunch THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.has_dinner THEN 1 ELSE 0 END) +
    (CASE WHEN NEW.has_supper THEN 1 ELSE 0 END);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular total_meals automaticamente
DROP TRIGGER IF EXISTS trigger_calculate_total_meals ON meal_schedules;
CREATE TRIGGER trigger_calculate_total_meals
  BEFORE INSERT OR UPDATE ON meal_schedules
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_meals();
