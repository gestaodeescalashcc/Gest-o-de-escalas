import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Search, AlertTriangle, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * Tela inicial: todos os setores como cartões (com sombra na cor do setor).
 *
 * Ao escolher um setor, o gestor entra no "mundo" dele — a lista de escalas
 * (e a grade) passa a ser só daquele setor (rota /escala?setor=<id>). A troca
 * de visão Planejada/Troca/Realizada acontece dentro da escala, pela sidebar.
 */

interface Setor {
  id: string;
  name: string;
  count: number;
}

// Paleta fixa; a cor de cada setor é estável (derivada do nome).
const PALETTE = [
  '#0ea5e9', '#10b981', '#a855f7', '#f59e0b', '#ef4444', '#6366f1',
  '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#84cc16',
  '#e11d48', '#0891b2', '#7c3aed',
];
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function SetorHub() {
  const navigate = useNavigate();
  const { isAdmin, allowedDepartments } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDepartments]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let deptQuery = supabase.from('departments').select('id, name').eq('active', true).order('name');
      // Não-admin vê só os setores permitidos.
      if (!isAdmin() && allowedDepartments && allowedDepartments.length > 0) {
        deptQuery = deptQuery.in('id', allowedDepartments);
      }
      const { data: depts, error: deptErr } = await deptQuery;
      if (deptErr) throw deptErr;

      const ids = (depts ?? []).map(d => d.id);
      const counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('professionals')
          .select('department_id')
          .eq('active', true)
          .in('department_id', ids);
        if (profErr) throw profErr;
        for (const p of profs ?? []) {
          const k = p.department_id as string;
          counts[k] = (counts[k] ?? 0) + 1;
        }
      }

      setSetores((depts ?? []).map(d => ({ id: d.id, name: d.name, count: counts[d.id] ?? 0 })));
    } catch (err: any) {
      console.error('Erro ao carregar setores:', err);
      setError(err.message || 'Erro ao carregar setores.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = normalize(search);
    return q ? setores.filter(s => normalize(s.name).includes(q)) : setores;
  }, [setores, search]);

  const open = (id: string) => navigate(`/escala?setor=${id}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Escalas por Setor</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Escolha um setor para trabalhar somente nas escalas dele.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" aria-hidden="true" />
          <label className="sr-only" htmlFor="setor-search">Buscar setor</label>
          <input
            id="setor-search"
            type="search"
            placeholder="Buscar setor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
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
          Carregando setores...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">Nenhum setor encontrado.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filtered.map(setor => {
            const color = colorFor(setor.name);
            const glowStyle = { '--glow': `${color}73`, '--glow-strong': `${color}bf` } as unknown as CSSProperties;
            return (
              <button
                key={setor.id}
                type="button"
                onClick={() => open(setor.id)}
                style={glowStyle}
                className="group text-left bg-white rounded-2xl border border-gray-100 p-5 transition-all duration-200 shadow-[0_16px_38px_-10px_var(--glow)] hover:shadow-[0_26px_54px_-12px_var(--glow-strong)] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl text-white flex-shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    <Building2 className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-bold text-gray-900 leading-tight truncate">{setor.name}</h2>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      {setor.count} {setor.count === 1 ? 'profissional' : 'profissionais'}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition flex-shrink-0" aria-hidden="true" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
