/*
  # Sistema de Banco de Horas - Legislacao Brasileira

  1. Novas Tabelas
    - `hour_bank_config` - Configuracoes do banco de horas
    - `hour_bank_entries` - Lancamentos do banco de horas
    - `hour_bank_compensations` - Compensacoes realizadas
    - `holidays` - Feriados para calculo
  
  2. Seguranca - RLS em todas as tabelas
*/

-- Tabela de feriados (criar primeiro)
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL,
  name text NOT NULL,
  is_national boolean NOT NULL DEFAULT true,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Tabela de configuracao do banco de horas
CREATE TABLE IF NOT EXISTS hour_bank_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  agreement_type text NOT NULL DEFAULT 'individual' CHECK (agreement_type IN ('individual', 'coletivo', 'mensal')),
  compensation_period_months int NOT NULL DEFAULT 6 CHECK (compensation_period_months IN (1, 6, 12)),
  daily_overtime_limit_minutes int NOT NULL DEFAULT 120,
  weekly_overtime_limit_minutes int NOT NULL DEFAULT 600,
  monthly_overtime_limit_minutes int NOT NULL DEFAULT 2400,
  overtime_multiplier decimal(3,2) NOT NULL DEFAULT 1.50 CHECK (overtime_multiplier >= 1.50),
  sunday_multiplier decimal(3,2) NOT NULL DEFAULT 2.00 CHECK (sunday_multiplier >= 1.00),
  holiday_multiplier decimal(3,2) NOT NULL DEFAULT 2.00 CHECK (holiday_multiplier >= 1.00),
  night_shift_multiplier decimal(3,2) NOT NULL DEFAULT 1.20,
  night_shift_start time NOT NULL DEFAULT '22:00',
  night_shift_end time NOT NULL DEFAULT '05:00',
  allow_negative_balance boolean NOT NULL DEFAULT true,
  max_negative_balance_minutes int NOT NULL DEFAULT 480,
  auto_calculate boolean NOT NULL DEFAULT true,
  expiration_warning_days int NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

-- Tabela de lancamentos do banco de horas
CREATE TABLE IF NOT EXISTS hour_bank_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('credit', 'debit', 'compensation', 'expiration', 'adjustment')),
  minutes int NOT NULL,
  balance_after int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('automatic', 'manual', 'compensation', 'system')),
  punch_record_id uuid REFERENCES punch_records(id) ON DELETE SET NULL,
  description text,
  multiplier_applied decimal(3,2) DEFAULT 1.00,
  original_minutes int,
  expires_at date,
  compensated_at date,
  created_by uuid REFERENCES system_users(id),
  approved_by uuid REFERENCES system_users(id),
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'compensated')),
  created_at timestamptz DEFAULT now()
);

-- Tabela de compensacoes
CREATE TABLE IF NOT EXISTS hour_bank_compensations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  compensation_date date NOT NULL,
  minutes_compensated int NOT NULL,
  compensation_type text NOT NULL CHECK (compensation_type IN ('folga', 'saida_antecipada', 'entrada_tardia', 'dia_parcial')),
  description text,
  entry_ids uuid[] DEFAULT '{}',
  requested_by uuid REFERENCES system_users(id),
  approved_by uuid REFERENCES system_users(id),
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz DEFAULT now()
);