-- =============================================================================
-- Converte shift_type de códigos curtos (P, SD, SN...) para nomes completos
-- (que é o formato esperado pelo frontend)
-- =============================================================================

UPDATE shifts SET shift_type = 'Serviço Noturno (19h às 7h) 12h'      WHERE shift_type = 'SN';
UPDATE shifts SET shift_type = 'Serviço Diurno (7h às 19h) 12h'       WHERE shift_type = 'SD';
UPDATE shifts SET shift_type = 'Manhã (7h às 13h) 6h'                  WHERE shift_type = 'M';
UPDATE shifts SET shift_type = 'Manhã (8h às 12h) 4h'                  WHERE shift_type = 'M2';
UPDATE shifts SET shift_type = 'Tarde (12h às 18h) 6h'                 WHERE shift_type = 'T';
UPDATE shifts SET shift_type = 'Manhã e Tarde (8h às 17h) 8h'          WHERE shift_type = 'MT';
UPDATE shifts SET shift_type = 'Plantão 24h (7h às 7h) 24h'            WHERE shift_type = 'P';
UPDATE shifts SET shift_type = 'Folga'                                 WHERE shift_type = 'FG';
UPDATE shifts SET shift_type = 'Feriado'                               WHERE shift_type = 'FR';
UPDATE shifts SET shift_type = 'Férias'                                WHERE shift_type = 'FE';
UPDATE shifts SET shift_type = 'Falta'                                 WHERE shift_type = 'FA';
UPDATE shifts SET shift_type = 'Licença Prêmio'                        WHERE shift_type = 'LP';
UPDATE shifts SET shift_type = 'Licença Médica'                        WHERE shift_type = 'LM';
UPDATE shifts SET shift_type = 'Licença Gestação'                      WHERE shift_type = 'LG';
UPDATE shifts SET shift_type = 'Afastamento À Serviço'                 WHERE shift_type = 'AS';

-- Verificação
SELECT shift_type, COUNT(*)
FROM shifts
GROUP BY shift_type
ORDER BY shift_type;
