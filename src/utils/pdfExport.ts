export const escapeHTML = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const getHolidaysForMonth = (year: number, month: number): string => {
  const holidays: Record<string, Array<{ day: number; name: string }>> = {
    '1': [
      { day: 1, name: 'Confraternização Universal' }
    ],
    '2': [],
    '3': [],
    '4': [
      { day: 21, name: 'Tiradentes' }
    ],
    '5': [
      { day: 1, name: 'Dia do Trabalho' }
    ],
    '6': [],
    '7': [],
    '8': [],
    '9': [
      { day: 7, name: 'Independência do Brasil' }
    ],
    '10': [
      { day: 12, name: 'Nossa Senhora Aparecida' }
    ],
    '11': [
      { day: 2, name: 'Finados' },
      { day: 15, name: 'Proclamação da República' },
      { day: 20, name: 'Consciência Negra' }
    ],
    '12': [
      { day: 25, name: 'Natal' }
    ]
  };

  const easterHolidays = getEasterHolidays(year);

  const monthHolidays = holidays[month.toString()] || [];
  const easterMonthHolidays = easterHolidays.filter(h => h.month === month);

  const allHolidays = [...monthHolidays.map(h => ({ ...h, month })), ...easterMonthHolidays];

  if (allHolidays.length === 0) {
    return '';
  }

  return `
    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
      <h4 style="font-size: 12px; margin-bottom: 10px; color: #1f2937; font-weight: 600;">Feriados Nacionais deste Mês:</h4>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 10px;">
        ${allHolidays
          .sort((a, b) => a.day - b.day)
          .map(holiday => `
            <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
              <strong style="color: #dc2626;">${holiday.day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}:</strong>
              <span style="color: #6b7280;"> ${holiday.name}</span>
            </div>
          `).join('')}
      </div>
    </div>
  `;
};

const getEasterHolidays = (year: number): Array<{ day: number; month: number; name: string }> => {
  const easter = calculateEaster(year);
  const carnaval = new Date(easter);
  carnaval.setDate(easter.getDate() - 47);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);

  return [
    {
      day: carnaval.getDate(),
      month: carnaval.getMonth() + 1,
      name: 'Carnaval'
    },
    {
      day: goodFriday.getDate(),
      month: goodFriday.getMonth() + 1,
      name: 'Sexta-feira Santa'
    },
    {
      day: corpusChristi.getDate(),
      month: corpusChristi.getMonth() + 1,
      name: 'Corpus Christi'
    }
  ];
};

const calculateEaster = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

export const exportToPDF = (content: HTMLElement, filename: string, onError?: (msg: string) => void) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    onError?.('Por favor, permita pop-ups para exportar o PDF');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${escapeHTML(filename)}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.5;
            color: #1f2937;
          }

          @media screen {
            body {
              padding: 20px;
              background: #f3f4f6;
            }
          }

          @media print {
            body {
              padding: 0;
              background: white;
            }

            table {
              page-break-inside: auto;
            }

            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }

            thead {
              display: table-header-group;
            }
          }

          @page {
            size: A4 landscape;
            margin: 1cm;
          }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
};

export const createPrintableSchedule = (
  scheduleName: string,
  departmentName: string,
  month: string,
  professionals: Array<{ full_name: string; category: { name: string } }>,
  daysInMonth: number,
  getShiftForDay: (profId: string, day: number) => string
) => {
  const [year, monthNum] = month.split('-').map(Number);
  const monthDate = new Date(year, monthNum - 1, 1);
  const monthName = monthDate.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });

  const container = document.createElement('div');
  container.innerHTML = `
    <div style="padding: 20px; background: white;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="margin: 0 0 10px 0; font-size: 24px; color: #1f2937; font-weight: 700;">${escapeHTML(scheduleName)}</h1>
        <p style="margin: 5px 0; font-size: 16px; color: #6b7280; font-weight: 500;">${escapeHTML(departmentName)}</p>
        <p style="margin: 5px 0; font-size: 14px; color: #9ca3af; text-transform: capitalize;">${escapeHTML(monthName)}</p>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 9px; background: white;">
        <thead>
          <tr style="background-color: #3b82f6; color: white;">
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; background-color: #3b82f6; min-width: 120px; font-weight: 600;">Profissional</th>
            ${Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
              const dayOfWeek = date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().substring(0, 3);
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
              return `<th style="border: 1px solid #d1d5db; padding: 6px 3px; text-align: center; background-color: ${isWeekend ? '#dc2626' : '#3b82f6'}; color: white; font-weight: 600; font-size: 8px;">
                <div>${day}</div>
                <div style="font-size: 7px; font-weight: 400;">${dayOfWeek}</div>
              </th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${professionals.map((prof, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#f9fafb' : 'white'};">
              <td style="border: 1px solid #d1d5db; padding: 8px 6px; font-weight: 600; font-size: 9px; background-color: ${idx % 2 === 0 ? '#f9fafb' : 'white'}; color: #1f2937;">
                <div style="margin-bottom: 2px;">${escapeHTML(prof.full_name)}</div>
                <div style="font-size: 7px; color: #6b7280; font-weight: 400;">${escapeHTML(prof.category.name)}</div>
              </td>
              ${Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const shift = getShiftForDay(prof.full_name, day);
                const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                return `<td style="border: 1px solid #d1d5db; padding: 4px 2px; text-align: center; background-color: ${isWeekend ? '#fee2e2' : 'white'}; font-weight: 700; font-size: 9px; color: #1f2937;">
                  ${escapeHTML(shift) || '-'}
                </td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top: 30px; padding: 20px; border-top: 2px solid #e5e7eb; background: #f9fafb;">
        <h3 style="font-size: 13px; margin-bottom: 12px; color: #1f2937; font-weight: 700;">Legenda de Turnos:</h3>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 10px; margin-bottom: 20px;">
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">SN:</strong> <span style="color: #6b7280;">Noite 19h-07h</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">SD:</strong> <span style="color: #6b7280;">Diurno 07h-19h</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">M:</strong> <span style="color: #6b7280;">Manhã 07h-13h</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">M2:</strong> <span style="color: #6b7280;">Manhã 08h-12h</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">T:</strong> <span style="color: #6b7280;">Tarde 12h-18h</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">MT:</strong> <span style="color: #6b7280;">Manhã e Tarde 08h-17h</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">24:</strong> <span style="color: #6b7280;">24 horas 07h-07h</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">FG:</strong> <span style="color: #6b7280;">Folga</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">FR:</strong> <span style="color: #6b7280;">Feriado</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">FE:</strong> <span style="color: #6b7280;">Férias</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">FA:</strong> <span style="color: #6b7280;">Falta</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">LP:</strong> <span style="color: #6b7280;">Licença Prêmio</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">LM:</strong> <span style="color: #6b7280;">Licença Médica</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">LG:</strong> <span style="color: #6b7280;">Licença Gestação</span>
          </div>
          <div style="padding: 6px; background: white; border-radius: 4px; border: 1px solid #e5e7eb;">
            <strong style="color: #1f2937;">AS:</strong> <span style="color: #6b7280;">Afastamento À Serviço</span>
          </div>
        </div>
        ${getHolidaysForMonth(year, monthNum)}
      </div>

      <div style="margin-top: 20px; text-align: center; font-size: 9px; color: #9ca3af; padding: 10px;">
        Documento gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  `;

  return container;
};
