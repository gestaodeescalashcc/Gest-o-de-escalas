/*
  # Adicionar Constraint UNIQUE para Prevenir Turnos Duplicados

  1. Problema Identificado
    - Profissionais aparecem múltiplas vezes na Escala do Dia
    - Turnos duplicados sendo criados para mesmo profissional/data/setor
    - Exemplo: Aline Santos tem 7 turnos duplicados para 01/12/2025
    
  2. Solução
    - Identificar e remover turnos duplicados (mantém apenas o mais recente)
    - Adicionar constraint UNIQUE para prevenir futuras duplicações
    - Constraint: (professional_id, shift_date, department_id, schedule_id)
    
  3. Limpeza de Dados
    - Remove turnos duplicados mantendo o mais recente (por created_at)
    - Preserva histórico e integridade dos dados
    
  4. Prevenção Futura
    - Constraint UNIQUE impede novos turnos duplicados
    - Aplicação precisa lidar com violação da constraint
    
  5. Notas Importantes
    - Um profissional pode ter apenas 1 turno por dia em cada escala
    - Turnos de diferentes escalas (schedule_id diferente) são permitidos
    - Turnos sem schedule_id (órfãos) também são verificados
*/

-- Passo 1: Identificar e deletar turnos duplicados
-- Mantém apenas o turno mais recente (maior created_at) de cada grupo
DO $$
DECLARE
  deleted_count INT;
BEGIN
  -- Delete duplicados mantendo o mais recente
  WITH duplicates AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          professional_id, 
          shift_date, 
          department_id,
          COALESCE(schedule_id::text, 'null')
        ORDER BY created_at DESC
      ) as rn
    FROM shifts
  )
  DELETE FROM shifts
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RAISE NOTICE 'Turnos duplicados removidos: %', deleted_count;
END $$;

-- Passo 2: Adicionar constraint UNIQUE para prevenir duplicatas futuras
-- Note: Precisamos de um índice parcial porque schedule_id pode ser NULL
DO $$
BEGIN
  -- Primeiro, criar índice único para registros COM schedule_id
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'shifts_unique_with_schedule'
  ) THEN
    CREATE UNIQUE INDEX shifts_unique_with_schedule 
    ON shifts (professional_id, shift_date, department_id, schedule_id)
    WHERE schedule_id IS NOT NULL;
    
    RAISE NOTICE 'Índice único criado para turnos com schedule_id';
  END IF;

  -- Segundo, criar índice único para registros SEM schedule_id (órfãos)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'shifts_unique_without_schedule'
  ) THEN
    CREATE UNIQUE INDEX shifts_unique_without_schedule 
    ON shifts (professional_id, shift_date, department_id)
    WHERE schedule_id IS NULL;
    
    RAISE NOTICE 'Índice único criado para turnos órfãos (sem schedule_id)';
  END IF;
END $$;

-- Passo 3: Adicionar comentário explicativo
COMMENT ON INDEX shifts_unique_with_schedule IS 
  'Previne turnos duplicados: um profissional pode ter apenas 1 turno por dia em cada escala (schedule_id)';

COMMENT ON INDEX shifts_unique_without_schedule IS 
  'Previne turnos órfãos duplicados: um profissional pode ter apenas 1 turno órfão (sem schedule_id) por dia em cada departamento';
