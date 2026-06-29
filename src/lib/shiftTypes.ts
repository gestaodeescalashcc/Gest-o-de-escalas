// Catálogo central de tipos de turno (turnos + ausências).
// Fonte única usada pela grade da escala, exportação e importação de Excel.
//
// `name` é o que fica gravado em shifts.shift_type no banco; `code` é a sigla
// exibida na grade e usada nas planilhas (modelo FESF/HECC).

export interface ShiftType {
  code: string;
  name: string;
  start: string;
  end: string;
  hours: number;
}

export const SHIFT_TYPES: ShiftType[] = [
  { code: 'SN', name: 'Serviço Noturno (19h às 7h) 12h', start: '19:00', end: '07:00', hours: 12 },
  { code: 'SD', name: 'Serviço Diurno (7h às 19h) 12h', start: '07:00', end: '19:00', hours: 12 },
  { code: 'D', name: 'Diarista', start: '07:00', end: '13:00', hours: 6 },
  { code: 'M', name: 'Manhã (7h às 13h) 6h', start: '07:00', end: '13:00', hours: 6 },
  { code: 'M2', name: 'Manhã (8h às 12h) 4h', start: '08:00', end: '12:00', hours: 4 },
  { code: 'T', name: 'Tarde (12h às 18h) 6h', start: '12:00', end: '18:00', hours: 6 },
  { code: 'MT', name: 'Manhã e Tarde (8h às 17h) 8h', start: '08:00', end: '17:00', hours: 8 },
  { code: 'P', name: 'Plantão 24h (7h às 7h) 24h', start: '07:00', end: '07:00', hours: 24 },
  { code: 'FG', name: 'Folga', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FR', name: 'Feriado', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FE', name: 'Férias', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FA', name: 'Falta', start: '00:00', end: '00:00', hours: 0 },
  { code: 'LP', name: 'Licença Prêmio', start: '00:00', end: '00:00', hours: 0 },
  { code: 'LM', name: 'Licença Médica', start: '00:00', end: '00:00', hours: 0 },
  { code: 'LG', name: 'Licença Gestação', start: '00:00', end: '00:00', hours: 0 },
  { code: 'AS', name: 'Afastamento À Serviço', start: '00:00', end: '00:00', hours: 0 },
  // Códigos importados das planilhas (FESF) — marcadores de ausência.
  { code: 'FSN', name: 'Falta no SN', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FSD', name: 'Falta no SD', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FDS', name: 'Falta (FDS)', start: '00:00', end: '00:00', hours: 0 },
  { code: 'FP', name: 'Falta no Plantão', start: '00:00', end: '00:00', hours: 0 },
  { code: 'ATM', name: 'Atestado Médico', start: '00:00', end: '00:00', hours: 0 },
  // Códigos da legenda do modelo de importação (Julho/Nutrição e Junho/Farmácia).
  { code: 'FC', name: 'Facultativo', start: '00:00', end: '00:00', hours: 0 },
  { code: 'OU', name: 'Outros', start: '00:00', end: '00:00', hours: 0 },
  { code: 'INSS', name: 'Afastamento por Doença (INSS)', start: '00:00', end: '00:00', hours: 0 },
];

// Aliases: variações de código/texto que aparecem nas planilhas → código canônico.
// (o resolvedor já normaliza maiúsculas/acentos, então aqui usamos a forma normalizada)
const CODE_ALIASES: Record<string, string> = {
  FD: 'FR',          // modelo usa FD para Feriado; catálogo usa FR
  FERIADO: 'FR',
  FERIAS: 'FE',
  FOLGA: 'FG',
  FALTA: 'FA',
  FACULTATIVO: 'FC',
  OUTROS: 'OU',
  INSS: 'INSS',
  'LICENCA MEDICA': 'LM',
  'LICENCA GESTACAO': 'LG',
  ATESTADO: 'ATM',
};

const byCode = new Map(SHIFT_TYPES.map(s => [s.code, s]));

// Normaliza: maiúsculas, sem acento, espaços colapsados.
function normalize(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (diacríticos combinantes)
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Resolve uma célula da planilha para um ShiftType do catálogo.
 * Aceita siglas ("SD", "MT"), descrições completas ("SD - SERVIÇO DIURNO ...")
 * e variações textuais ("FÉRIAS", "FERIADO"). Retorna null se desconhecido.
 */
export function resolveShiftCode(raw: string | null | undefined): ShiftType | null {
  if (raw == null) return null;
  const norm = normalize(String(raw));
  if (!norm) return null;

  // 1) primeiro token antes de espaço ou hífen (ex.: "SD - SERVIÇO..." → "SD")
  const token = norm.split(/[\s-]/)[0];

  // 2) tenta token direto no catálogo, depois alias do token, depois texto inteiro nos aliases
  const candidate =
    (byCode.has(token) && token) ||
    CODE_ALIASES[token] ||
    CODE_ALIASES[norm] ||
    null;

  if (candidate && byCode.has(candidate)) return byCode.get(candidate)!;
  if (byCode.has(token)) return byCode.get(token)!;
  return null;
}

export const getShiftByCode = (code: string): ShiftType | undefined => byCode.get(code);
export const getShiftByName = (name: string): ShiftType | undefined =>
  SHIFT_TYPES.find(s => s.name === name);
