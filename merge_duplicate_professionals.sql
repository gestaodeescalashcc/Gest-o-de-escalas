-- =============================================================================
-- MERGE AUTOMÁTICO DE PROFISSIONAIS DUPLICADOS
--
-- Para cada grupo de duplicatas (mesmo nome normalizado):
-- 1. Escolhe o "principal" = ativo + mais vínculos (turnos, ausências) + mais antigo
-- 2. Move todos os turnos, ausências, coverage_professional dos outros pro principal
-- 3. Apaga os duplicados
--
-- ⚠️ Antes de rodar, recomenda-se rodar o diagnose_duplicate_professionals.sql
--    e revisar os grupos identificados.
-- =============================================================================

DO $$
DECLARE
  rec RECORD;
  duplicate_id uuid;
  primary_id uuid;
  merged_count integer := 0;
  duplicates_removed integer := 0;
BEGIN
  -- Para cada grupo de duplicatas
  FOR rec IN (
    WITH normalized AS (
      SELECT
        id,
        active,
        created_at,
        regexp_replace(lower(unaccent(full_name)), '[^a-z0-9 ]+', '', 'g') AS norm_name
      FROM professionals
    ),
    grouped AS (
      SELECT norm_name, COUNT(*) AS qtd
      FROM normalized
      GROUP BY norm_name
      HAVING COUNT(*) > 1
    )
    SELECT
      g.norm_name,
      -- Pega o id "principal": ativo, com mais shifts, mais antigo
      (
        SELECT n.id FROM normalized n
        WHERE n.norm_name = g.norm_name
        ORDER BY
          n.active DESC,
          (SELECT COUNT(*) FROM shifts WHERE professional_id = n.id) DESC,
          (SELECT COUNT(*) FROM absences WHERE professional_id = n.id) DESC,
          n.created_at ASC
        LIMIT 1
      ) AS primary_id,
      -- Lista de duplicatas (excluindo o principal)
      ARRAY(
        SELECT n.id FROM normalized n
        WHERE n.norm_name = g.norm_name
        ORDER BY
          n.active DESC,
          (SELECT COUNT(*) FROM shifts WHERE professional_id = n.id) DESC,
          (SELECT COUNT(*) FROM absences WHERE professional_id = n.id) DESC,
          n.created_at ASC
      ) AS all_ids
    FROM grouped g
  ) LOOP
    primary_id := rec.primary_id;

    -- Para cada duplicata (excluindo o principal)
    FOREACH duplicate_id IN ARRAY rec.all_ids
    LOOP
      IF duplicate_id = primary_id THEN
        CONTINUE;
      END IF;

      -- Mover shifts
      UPDATE shifts SET professional_id = primary_id WHERE professional_id = duplicate_id;

      -- Mover absences
      UPDATE absences SET professional_id = primary_id WHERE professional_id = duplicate_id;
      UPDATE absences SET coverage_professional_id = primary_id WHERE coverage_professional_id = duplicate_id;

      -- Mover swap requests (se a tabela existir)
      BEGIN
        UPDATE shift_swaps SET requesting_professional_id = primary_id WHERE requesting_professional_id = duplicate_id;
        UPDATE shift_swaps SET target_professional_id = primary_id WHERE target_professional_id = duplicate_id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- Mover punch_records (se existir)
      BEGIN
        UPDATE punch_records SET professional_id = primary_id WHERE professional_id = duplicate_id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- Mover timesheet_records
      BEGIN
        UPDATE timesheet_records SET professional_id = primary_id WHERE professional_id = duplicate_id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- Mover meal_schedules
      BEGIN
        UPDATE meal_schedules SET professional_id = primary_id WHERE professional_id = duplicate_id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- Mover hour_bank_entries
      BEGIN
        UPDATE hour_bank_entries SET professional_id = primary_id WHERE professional_id = duplicate_id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- Mover hour_bank_compensations
      BEGIN
        UPDATE hour_bank_compensations SET professional_id = primary_id WHERE professional_id = duplicate_id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- Mover professional_facial_data — se há conflito, deletar a do duplicado
      BEGIN
        IF EXISTS (SELECT 1 FROM professional_facial_data WHERE professional_id = primary_id)
           AND EXISTS (SELECT 1 FROM professional_facial_data WHERE professional_id = duplicate_id) THEN
          DELETE FROM professional_facial_data WHERE professional_id = duplicate_id;
        ELSE
          UPDATE professional_facial_data SET professional_id = primary_id WHERE professional_id = duplicate_id;
        END IF;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- Apagar shift_history que apontam pra esse profissional via shifts? Já moveu via shifts.
      -- punch_audit_log, punch_adjustments — também se aplicáveis
      BEGIN
        UPDATE punch_adjustments SET professional_id = primary_id WHERE professional_id = duplicate_id;
      EXCEPTION WHEN undefined_table THEN NULL;
      END;

      -- Por fim: deletar o duplicado
      DELETE FROM professionals WHERE id = duplicate_id;
      duplicates_removed := duplicates_removed + 1;
    END LOOP;
    merged_count := merged_count + 1;
  END LOOP;

  RAISE NOTICE '------------------------------------------';
  RAISE NOTICE 'Grupos de duplicatas mesclados: %', merged_count;
  RAISE NOTICE 'Profissionais duplicados removidos: %', duplicates_removed;
END $$;

-- Verificação: mostrar se ainda há duplicatas
SELECT
  regexp_replace(lower(unaccent(full_name)), '[^a-z0-9 ]+', '', 'g') AS norm_name,
  COUNT(*) AS qtd
FROM professionals
GROUP BY norm_name
HAVING COUNT(*) > 1
ORDER BY qtd DESC;
-- Deve retornar 0 linhas se tudo deu certo
