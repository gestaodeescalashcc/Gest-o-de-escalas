import { describe, it, expect, vi, beforeEach } from 'vitest';
import { escapeHTML, exportToPDF, createPrintableSchedule } from '../../utils/pdfExport';

describe('escapeHTML', () => {
  it('returns empty string for falsy input', () => {
    expect(escapeHTML('')).toBe('');
    expect(escapeHTML(null as unknown as string)).toBe('');
    expect(escapeHTML(undefined as unknown as string)).toBe('');
  });

  it('escapes ampersand', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than and greater-than', () => {
    expect(escapeHTML('<div>')).toBe('&lt;div&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHTML('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHTML("it's")).toBe('it&#39;s');
  });

  it('escapes all special characters in one string', () => {
    const result = escapeHTML('<script>"alert(\'xss\')"</script>&');
    expect(result).toBe('&lt;script&gt;&quot;alert(&#39;xss&#39;)&quot;&lt;/script&gt;&amp;');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHTML('Hello World 123')).toBe('Hello World 123');
  });
});

describe('exportToPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls window.open with empty string and _blank', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>Content</p>';
    exportToPDF(el, 'test.pdf');
    expect(window.open).toHaveBeenCalledWith('', '_blank');
  });

  it('calls onError callback when window.open returns null', () => {
    vi.spyOn(window, 'open').mockReturnValueOnce(null);
    const el = document.createElement('div');
    const onError = vi.fn();
    exportToPDF(el, 'test.pdf', onError);
    expect(onError).toHaveBeenCalledWith('Por favor, permita pop-ups para exportar o PDF');
  });

  it('does not throw when window.open succeeds', () => {
    const el = document.createElement('div');
    expect(() => exportToPDF(el, 'test.pdf')).not.toThrow();
  });
});

describe('createPrintableSchedule', () => {
  const professionals = [
    { full_name: 'Ana Lima', category: { name: 'Enfermeira' } },
    { full_name: 'João Silva', category: { name: 'Médico' } },
  ];

  const getShiftForDay = (_profName: string, day: number) =>
    day === 1 ? 'SN' : day === 2 ? 'SD' : '';

  it('returns an HTMLDivElement', () => {
    const container = createPrintableSchedule(
      'Escala Janeiro',
      'UTI',
      '2025-01',
      professionals,
      31,
      getShiftForDay
    );
    expect(container).toBeInstanceOf(HTMLDivElement);
  });

  it('includes the schedule name in the output', () => {
    const container = createPrintableSchedule(
      'Escala Janeiro',
      'UTI',
      '2025-01',
      professionals,
      31,
      getShiftForDay
    );
    expect(container.innerHTML).toContain('Escala Janeiro');
  });

  it('includes the department name', () => {
    const container = createPrintableSchedule(
      'Escala Janeiro',
      'UTI Pediátrica',
      '2025-01',
      professionals,
      31,
      getShiftForDay
    );
    expect(container.innerHTML).toContain('UTI Pedi');
  });

  it('includes all professional names', () => {
    const container = createPrintableSchedule(
      'Escala',
      'Dept',
      '2025-06',
      professionals,
      30,
      getShiftForDay
    );
    expect(container.innerHTML).toContain('Ana Lima');
    expect(container.innerHTML).toContain('João Silva');
  });

  it('includes shift codes returned by getShiftForDay', () => {
    const container = createPrintableSchedule(
      'Escala',
      'Dept',
      '2025-06',
      professionals,
      30,
      getShiftForDay
    );
    expect(container.innerHTML).toContain('SN');
    expect(container.innerHTML).toContain('SD');
  });

  it('renders correct number of day columns', () => {
    const container = createPrintableSchedule(
      'Escala',
      'Dept',
      '2025-02',
      professionals,
      28,
      getShiftForDay
    );
    const thElements = container.querySelectorAll('th');
    expect(thElements.length).toBe(29);
  });

  it('escapes HTML in professional names', () => {
    const unsafeProfessionals = [
      { full_name: '<script>alert(1)</script>', category: { name: 'Test' } },
    ];
    const container = createPrintableSchedule(
      'Escala',
      'Dept',
      '2025-01',
      unsafeProfessionals,
      31,
      getShiftForDay
    );
    expect(container.innerHTML).not.toContain('<script>alert(1)</script>');
    expect(container.innerHTML).toContain('&lt;script&gt;');
  });

  it('includes shift legend in the output', () => {
    const container = createPrintableSchedule(
      'Escala',
      'Dept',
      '2025-01',
      professionals,
      31,
      getShiftForDay
    );
    expect(container.innerHTML).toContain('SN:');
    expect(container.innerHTML).toContain('SD:');
    expect(container.innerHTML).toContain('FG:');
  });

  it('includes national holidays section for January', () => {
    const container = createPrintableSchedule(
      'Escala',
      'Dept',
      '2025-01',
      professionals,
      31,
      getShiftForDay
    );
    expect(container.innerHTML).toContain('Confraternização Universal');
  });

  it('includes national holidays section for November', () => {
    const container = createPrintableSchedule(
      'Escala',
      'Dept',
      '2025-11',
      professionals,
      30,
      getShiftForDay
    );
    expect(container.innerHTML).toContain('Finados');
    expect(container.innerHTML).toContain('Proclamação da República');
  });
});
