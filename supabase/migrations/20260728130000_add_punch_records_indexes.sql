-- punch_records só tinha índice na PK. O padrão de uso óbvio (pontos de um
-- profissional num intervalo de datas; pontos de um estabelecimento por NSR
-- sequencial) faria table scan assim que o módulo de ponto tivesse uso real.

CREATE INDEX IF NOT EXISTS idx_punch_records_professional_datetime
  ON public.punch_records (professional_id, punch_datetime);

CREATE INDEX IF NOT EXISTS idx_punch_records_establishment_nsr
  ON public.punch_records (establishment_id, nsr);
