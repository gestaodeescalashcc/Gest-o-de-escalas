-- =============================================================================
-- Normaliza valores legados de shift_type (dados antigos não importados agora)
-- =============================================================================

-- Conversões diretas (alta confiança)
UPDATE shifts SET shift_type = 'Plantão 24h (7h às 7h) 24h'      WHERE shift_type = '24h';
UPDATE shifts SET shift_type = 'Serviço Diurno (7h às 19h) 12h'  WHERE shift_type = 'Diurno';
UPDATE shifts SET shift_type = 'Serviço Noturno (19h às 7h) 12h' WHERE shift_type = 'Noite';
UPDATE shifts SET shift_type = 'Folga'                            WHERE shift_type = 'Folga';
UPDATE shifts SET shift_type = 'Manhã (7h às 13h) 6h'             WHERE shift_type = 'Manhã';
UPDATE shifts SET shift_type = 'Tarde (12h às 18h) 6h'            WHERE shift_type = 'TD';

-- ⚠ "MH" é ambíguo (Manhã? Manhã e Tarde?). Lista os afetados antes de decidir:
SELECT s.id, s.shift_date, s.shift_type, p.full_name, d.name AS setor
FROM shifts s
JOIN professionals p ON p.id = s.professional_id
JOIN departments d ON d.id = s.department_id
WHERE s.shift_type IN ('MH')
ORDER BY s.shift_date;

-- Verificação final
SELECT shift_type, COUNT(*)
FROM shifts
GROUP BY shift_type
ORDER BY COUNT(*) DESC;
