import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Hub de Escala Médica.
 *
 * As 3 categorias de médico (Plantonista / Diarista / Interconsultor) são, no
 * modelo de dados, 3 SETORES (departments) independentes — cada um com sua
 * própria escala mensal. Esta tela é o ponto de entrada: mostra os 3 setores
 * como cartões e leva o gestor direto para a lista de escalas daquele setor
 * (rota /escala?modo=planejada&setor=<id>).
 *
 * Enquanto a migração de dados não roda, os setores podem não existir ainda —
 * a tela lida com isso mostrando o cartão como "não configurado".
 */

interface MedCategory {
  /** Nome EXATO do setor no banco (department.name). */
  deptName: string;
  label: string;
  /** Cor da categoria (mesma do import de médicos). */
  color: string;
  description: string;
}

// Ordem e cores espelham as categorias criadas no import de maio.
const MED_CATEGORIES: MedCategory[] = [
  {
    deptName: 'Plantonistas',
    label: 'Plantonistas',
    color: '#0ea5e9',
    description: 'Plantões de 12h — Serviço Diurno (7h–19h) e Noturno (19h–7h).',
  },
  {
    deptName: 'Diaristas',
    label: 'Diaristas',
    color: '#10b981',
    description: 'Diaristas em turnos fixos ao longo da semana.',
  },
  {
    deptName: 'Interconsultores',
    label: 'Interconsultores',
    color: '#a855f7',
    description: 'Interconsultas por especialidade (manhã/tarde).',
  },
];

// As 3 camadas da escala (mesmas do menu lateral), com as cores de cada modo.
const MODES: { mode: string; label: string; cls: string }[] = [
  { mode: 'planejada', label: 'Planejada', cls: 'bg-blue-50 text-blue-700 hover:bg-blue-100 focus:ring-blue-500' },
  { mode: 'troca', label: 'Trocas', cls: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 focus:ring-indigo-500' },
  { mode: 'realizada', label: 'Realizada', cls: 'bg-orange-50 text-orange-700 hover:bg-orange-100 focus:ring-orange-500' },
];

interface DeptInfo {
  id: string | null;
  count: number;
}

export default function MedicalScheduleHub() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Mapa deptName -> { id, count de profissionais ativos }
  const [info, setInfo] = useState<Record<string, DeptInfo>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const names = MED_CATEGORIES.map(c => c.deptName);

      const { data: depts, error: deptErr } = await supabase
        .from('departments')
        .select('id, name')
        .in('name', names);
      if (deptErr) throw deptErr;

      const byName: Record<string, DeptInfo> = {};
      for (const c of MED_CATEGORIES) byName[c.deptName] = { id: null, count: 0 };

      const deptIds = (depts ?? []).map(d => d.id);
      for (const d of depts ?? []) {
        if (byName[d.name]) byName[d.name].id = d.id;
      }

      // Conta profissionais ativos por setor (client-side; volume é pequeno).
      if (deptIds.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('professionals')
          .select('department_id')
          .eq('active', true)
          .in('department_id', deptIds);
        if (profErr) throw profErr;

        const nameById: Record<string, string> = {};
        for (const d of depts ?? []) nameById[d.id] = d.name;
        for (const p of profs ?? []) {
          const name = nameById[p.department_id as string];
          if (name && byName[name]) byName[name].count += 1;
        }
      }

      setInfo(byName);
    } catch (err: any) {
      console.error('Erro ao carregar setores médicos:', err);
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const openSchedule = (deptId: string, mode: string) => {
    navigate(`/escala?modo=${mode}&setor=${deptId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Stethoscope className="w-6 h-6 text-blue-600" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Escala Médica</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Escolha a categoria para trabalhar nas escalas correspondentes.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" aria-hidden="true" />
          Carregando categorias...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {MED_CATEGORIES.map(cat => {
            const deptInfo = info[cat.deptName];
            const configured = !!deptInfo?.id;
            // Sombra colorida (glow) na cor da categoria — mais forte no hover.
            const glowStyle = configured
              ? ({ '--glow': `${cat.color}73`, '--glow-strong': `${cat.color}bf` } as unknown as CSSProperties)
              : undefined;

            return (
              <div
                key={cat.deptName}
                style={glowStyle}
                className={`relative bg-white rounded-2xl border transition-all duration-200 ${
                  configured
                    ? 'border-gray-100 shadow-[0_16px_38px_-10px_var(--glow)] hover:shadow-[0_26px_54px_-12px_var(--glow-strong)] hover:-translate-y-0.5'
                    : 'border-dashed border-gray-300 shadow-sm opacity-80'
                }`}
              >
                <div className="p-5 sm:p-6 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      <Stethoscope className="w-5 h-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 leading-tight">{cat.label}</h2>
                      {configured ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                          <Users className="w-3.5 h-3.5" aria-hidden="true" />
                          {deptInfo.count} {deptInfo.count === 1 ? 'médico' : 'médicos'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          Setor não configurado
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 flex-1">{cat.description}</p>

                  <div className="mt-5">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Abrir escala:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {MODES.map(m => (
                        <button
                          key={m.mode}
                          type="button"
                          disabled={!configured}
                          onClick={() => configured && openSchedule(deptInfo!.id!, m.mode)}
                          className={`inline-flex items-center justify-center min-h-[40px] px-2 py-2 rounded-lg text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                            configured ? m.cls : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                          title={configured ? `${cat.label} — ${m.label}` : 'Setor não configurado'}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
