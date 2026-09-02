import { describe, it, expect } from 'vitest';
import {
  buildConsolidadoRows,
  type ConsolidadoProfessional,
  type ConsolidadoShift,
} from '../../utils/consolidadoExport';

// As regras testadas aqui foram lidas de consolidados REAIS entregues à FESF
// (FISIO/agosto-2026 e HECC/julho-2026), não inventadas:
//   - total de plantões = diurnos + noturnos; M/T fica de fora (fórmula =G+H)
//   - horas noturnas = noturnos × 9 (adicional das 22h ao fim da jornada)
//   - falta injustificada vira HORAS + DATAS; atestado vai só em observações
//   - M/T: dia inteiro é número puro ("21"); meia jornada é texto ("2M 1T")

const MES = '2026-08';

function prof(over: Partial<ConsolidadoProfessional> = {}): ConsolidadoProfessional {
  return {
    id: 'p1',
    full_name: 'Fulana de Tal',
    registration_number: '17905',
    cpf: '04516815-12',
    cargo: 'Fisioterapeuta',
    contracted_hours_per_month: 120,
    ...over,
  };
}

function turnos(codes: Array<[number, string]>, professional_id = 'p1'): ConsolidadoShift[] {
  return codes.map(([dia, code]) => ({
    professional_id,
    shift_date: `${MES}-${String(dia).padStart(2, '0')}`,
    code,
  }));
}

describe('buildConsolidadoRows — contagem de plantões', () => {
  it('separa diurno de noturno', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: turnos([[1, 'SD'], [3, 'SD'], [5, 'SN'], [7, 'SN'], [9, 'SN']]),
      absences: [],
    });
    expect(linha.diurnos).toBe(2);
    expect(linha.noturnos).toBe(3);
  });

  it('mantém M/T fora da contagem de plantões (o total do formulário é só G+H)', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: turnos([[1, 'SD'], [2, 'M'], [3, 'T']]),
      absences: [],
    });
    expect(linha.diurnos).toBe(1);
    expect(linha.noturnos).toBe('');
    expect(linha.mt).toBe('1M 1T');
  });

  it('escreve M/T de dia inteiro como número puro (padrão do administrativo)', () => {
    const dias: Array<[number, string]> = [];
    for (let d = 1; d <= 21; d++) dias.push([d, 'MT']);
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof({ cargo: 'Assistente Administrativo' })],
      shifts: turnos(dias),
      absences: [],
    });
    expect(linha.mt).toBe(21);
  });

  it('ignora plantão de outro mês', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: [
        { professional_id: 'p1', shift_date: '2026-08-04', code: 'SD' },
        { professional_id: 'p1', shift_date: '2026-07-04', code: 'SD' },
      ],
      absences: [],
    });
    expect(linha.diurnos).toBe(1);
  });

  it('denuncia plantão de 24h em observações em vez de somar calado', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: turnos([[1, 'P'], [2, 'P']]),
      absences: [],
    });
    expect(linha.observacoes).toContain('PLANTÃO 24H: 2');
  });
});

describe('buildConsolidadoRows — faltas e atestados', () => {
  it('falta injustificada vira horas e datas', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: turnos([[1, 'SD']]),
      absences: [
        {
          professional_id: 'p1',
          start_date: '2026-08-13',
          end_date: '2026-08-13',
          shift_type: 'SD',
          hours_per_day: 12,
          is_justified: false,
          reason_name: 'Falta injustificada',
        },
        {
          professional_id: 'p1',
          start_date: '2026-08-18',
          end_date: '2026-08-18',
          shift_type: 'SN',
          hours_per_day: 12,
          is_justified: false,
          reason_name: 'Falta injustificada',
        },
      ],
    });
    expect(linha.faltasHoras).toBe(24);
    expect(linha.datasFaltas).toBe('13,18');
    expect(linha.observacoes).toContain('FALTA: 13SD - 18SN');
  });

  it('atestado NÃO entra em horas de falta — só em observações', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: turnos([[1, 'SD']]),
      absences: [
        {
          professional_id: 'p1',
          start_date: '2026-08-12',
          end_date: '2026-08-14',
          shift_type: 'SD',
          hours_per_day: 12,
          is_justified: true,
          reason_name: 'Atestado médico',
        },
      ],
    });
    expect(linha.faltasHoras).toBe('');
    expect(linha.datasFaltas).toBe('');
    expect(linha.observacoes).toBe('ATM: 12, 13, 14');
  });

  it('conta as horas pelo turno quando a ausência não traz hours_per_day', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: turnos([[1, 'SD']]),
      absences: [
        {
          professional_id: 'p1',
          start_date: '2026-08-05',
          end_date: '2026-08-05',
          shift_type: 'SD',
          is_justified: false,
          reason_name: 'Falta injustificada',
        },
      ],
    });
    expect(linha.faltasHoras).toBe(12);
  });

  it('recorta o intervalo da ausência que atravessa a virada do mês', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: turnos([[1, 'SD']]),
      absences: [
        {
          professional_id: 'p1',
          start_date: '2026-08-30',
          end_date: '2026-09-02',
          shift_type: 'SD',
          hours_per_day: 12,
          is_justified: false,
          reason_name: 'Falta injustificada',
        },
      ],
    });
    // Só 30 e 31 pertencem a agosto.
    expect(linha.datasFaltas).toBe('30,31');
    expect(linha.faltasHoras).toBe(24);
  });
});

describe('buildConsolidadoRows — montagem da lista', () => {
  it('omite quem não teve plantão nem ausência no mês', () => {
    const linhas = buildConsolidadoRows({
      mes: MES,
      professionals: [prof(), prof({ id: 'p2', full_name: 'Sem Escala' })],
      shifts: turnos([[1, 'SD']]),
      absences: [],
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].nome).toBe('Fulana de Tal');
  });

  it('mantém quem só teve ausência (falta o mês inteiro ainda é frequência)', () => {
    const linhas = buildConsolidadoRows({
      mes: MES,
      professionals: [prof({ id: 'p2', full_name: 'So Ausencia' })],
      shifts: [],
      absences: [
        {
          professional_id: 'p2',
          start_date: '2026-08-03',
          end_date: '2026-08-03',
          shift_type: 'SD',
          hours_per_day: 12,
          is_justified: false,
          reason_name: 'Falta injustificada',
        },
      ],
    });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].faltasHoras).toBe(12);
  });

  it('numera as linhas em sequência, sem buraco', () => {
    const linhas = buildConsolidadoRows({
      mes: MES,
      professionals: [
        prof({ id: 'a', full_name: 'A' }),
        prof({ id: 'sem', full_name: 'Sem nada' }),
        prof({ id: 'b', full_name: 'B' }),
      ],
      shifts: [...turnos([[1, 'SD']], 'a'), ...turnos([[2, 'SD']], 'b')],
      absences: [],
    });
    expect(linhas.map(l => l.numero)).toEqual([1, 2]);
    expect(linhas.map(l => l.nome)).toEqual(['A', 'B']);
  });

  it('leva identificação e CH do cadastro para a linha', () => {
    const [linha] = buildConsolidadoRows({
      mes: MES,
      professionals: [prof()],
      shifts: turnos([[1, 'SD']]),
      absences: [],
    });
    expect(linha.matricula).toBe('17905');
    expect(linha.cpf).toBe('04516815-12');
    expect(linha.cargo).toBe('Fisioterapeuta');
    expect(linha.ch).toBe(120);
    expect(linha.unidade).toBe('HECC');
  });
});
