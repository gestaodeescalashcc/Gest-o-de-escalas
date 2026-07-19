import { ReactNode, useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Users,
  ArrowLeftRight,
  BarChart3,
  Menu,
  X,
  LogOut,
  Building2,
  Clock,
  LayoutGrid,
  ClipboardList,
  UserCog,
  Fingerprint,
  FileText,
  Database,
  Briefcase,
  FileCheck,
  Edit3,
  Shield,
  Wallet,
  Search,
  ChevronDown,
  CalendarX,
  KeyRound,
  Repeat,
  CheckCircle2,
  Home,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';

interface DashboardLayoutProps {
  children: ReactNode;
}

type Module =
  | 'schedules'
  | 'professionals'
  | 'swaps'
  | 'reports'
  | 'departments'
  | 'professional_categories'
  | 'companies'
  | 'users'
  | 'absences';

type AccentColor = 'blue' | 'indigo' | 'orange' | 'emerald';

interface MenuItem {
  id: string;
  path: string;
  label: string;
  icon: typeof Calendar;
  module: Module;
  group: string;
  keywords?: string;
  /** Quando definido, item só aparece para usuários com essa role. */
  onlyForRole?: string;
  /** Quando definido, item NÃO aparece para usuários com essas roles. */
  hiddenForRoles?: string[];
  /** Cor de destaque quando ativo. Padrão: blue. */
  accent?: AccentColor;
  /**
   * Bate com uma URL que já casou o path — usado para desempate entre itens
   * que apontam para o mesmo pathname (ex.: 3 camadas da mesma escala).
   * Recebe (pathname, search) e devolve true se este item é o dono.
   */
  matches?: (pathname: string, search: string) => boolean;
  /**
   * Quando definido, o clique troca apenas o MODO da escala aberta (mantém a
   * mesma escala/setor). Ver scheduleModeTarget.
   */
  scheduleMode?: 'planejada' | 'troca' | 'realizada';
}

// Destino do clique nos itens de modo, preservando o contexto atual:
// - dentro de uma escala aberta (/escala/:id/:modo) → troca só o modo, mesma escala
// - na lista de um setor (/escala?setor=X) → mantém o setor, troca o modo
// - caso geral → lista no modo escolhido
function scheduleModeTarget(mode: string, pathname: string, search: string): string {
  const detail = pathname.match(/^\/escala\/([^/]+)\/[^/]+$/);
  if (detail) return `/escala/${detail[1]}/${mode}`;
  if (pathname === '/escala') {
    const setor = new URLSearchParams(search).get('setor');
    return setor ? `/escala?modo=${mode}&setor=${setor}` : `/escala?modo=${mode}`;
  }
  return `/escala?modo=${mode}`;
}

// Casadores das 3 camadas da escala:
// - lista: /escala?modo=X
// - detalhe: /escala/:id/X
const matchScheduleMode = (mode: 'planejada' | 'troca' | 'realizada') =>
  (pathname: string, search: string) => {
    if (pathname === '/escala') {
      const raw = new URLSearchParams(search).get('modo');
      // Fallback para planejada quando não há query, para casar com o comportamento do roteador.
      return (raw ?? 'planejada') === mode;
    }
    if (pathname.startsWith('/escala/')) {
      const segs = pathname.split('/');
      // /escala/:id/:modo → segs = ['', 'escala', ':id', ':modo']
      return segs[3] === mode;
    }
    return false;
  };

const ACCENT_CLASSES: Record<AccentColor, {
  bg: string; text: string; icon: string; bar: string;
}> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-600', bar: 'bg-blue-600' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-600', bar: 'bg-indigo-600' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', icon: 'text-orange-600', bar: 'bg-orange-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-600', bar: 'bg-emerald-600' },
};

const MENU_GROUPS = [
  { id: 'schedule', label: 'Escalas' },
  { id: 'rep-p', label: 'REP-P (Ponto)' },
  { id: 'tables', label: 'Tabelas' },
  { id: 'admin', label: 'Administração' },
] as const;

const MENU_ITEMS: MenuItem[] = [
  // Médico: tela pessoal — primeiro item, exclusivo da role Médico
  { id: 'my-schedule', path: '/minha-escala', label: 'Minha Escala', icon: Calendar, module: 'schedules', group: 'schedule', onlyForRole: 'Médico' },
  // Tela inicial: hub de setores. Cada setor abre só as escalas dele.
  { id: 'home', path: '/', label: 'Início', icon: Home, module: 'schedules', group: 'schedule', hiddenForRoles: ['Médico'], keywords: 'inicio home setores' },
  // Escalas: 3 páginas separadas, uma por camada. A grade é a mesma por baixo,
  // mas cada modo tem toolbar/popover próprios (ver ConsolidatedScheduleView).
  // A separação na sidebar é o que quebra a confusão visual — cada camada é uma "página".
  { id: 'schedule-planejada', path: '/escala?modo=planejada', label: 'Planejamento', icon: LayoutGrid, module: 'schedules', group: 'schedule', hiddenForRoles: ['Médico'], accent: 'blue', scheduleMode: 'planejada', matches: matchScheduleMode('planejada'), keywords: 'escala planejada mês montagem' },
  { id: 'schedule-troca', path: '/escala?modo=troca', label: 'Trocas & Remanejamento', icon: Repeat, module: 'schedules', group: 'schedule', hiddenForRoles: ['Médico'], accent: 'indigo', scheduleMode: 'troca', matches: matchScheduleMode('troca'), keywords: 'troca remanejamento reatribuir plantão' },
  { id: 'schedule-realizada', path: '/escala?modo=realizada', label: 'Realizada', icon: CheckCircle2, module: 'schedules', group: 'schedule', hiddenForRoles: ['Médico'], accent: 'orange', scheduleMode: 'realizada', matches: matchScheduleMode('realizada'), keywords: 'realizada faltas atestados coberturas' },
  { id: 'daily', path: '/escala-diaria', label: 'Escala do Dia', icon: ClipboardList, module: 'schedules', group: 'schedule', hiddenForRoles: ['Médico'] },
  { id: 'professionals', path: '/profissionais', label: 'Profissionais', icon: Users, module: 'professionals', group: 'schedule', hiddenForRoles: ['Médico'] },
  { id: 'swaps', path: '/trocas', label: 'Solicitações de Troca', icon: ArrowLeftRight, module: 'swaps', group: 'schedule', keywords: 'plantoes plantões solicitações' },
  { id: 'absenteeism', path: '/absenteismo', label: 'Absenteísmo', icon: CalendarX, module: 'absences', group: 'schedule', keywords: 'absenteismo faltas atestados', hiddenForRoles: ['Médico'] },
  // REP-P group
  { id: 'timesheet-clock', path: '/ponto/registro', label: 'Registro de Ponto', icon: Fingerprint, module: 'schedules', group: 'rep-p' },
  { id: 'punch-mirror', path: '/ponto/espelho', label: 'Espelho de Ponto', icon: FileText, module: 'reports', group: 'rep-p' },
  { id: 'punch-adjustments', path: '/ponto/ajustes', label: 'Ajustes de Ponto', icon: Edit3, module: 'schedules', group: 'rep-p' },
  { id: 'hour-bank', path: '/ponto/banco-horas', label: 'Banco de Horas', icon: Wallet, module: 'schedules', group: 'rep-p' },
  { id: 'fiscal-exports', path: '/ponto/exportacoes', label: 'Exportações Fiscais', icon: FileCheck, module: 'reports', group: 'rep-p', keywords: 'exportacoes' },
  { id: 'establishments', path: '/ponto/estabelecimentos', label: 'Estabelecimentos', icon: Building2, module: 'users', group: 'rep-p' },
  // Tables group
  { id: 'departments', path: '/setores', label: 'Setores', icon: Building2, module: 'departments', group: 'tables' },
  { id: 'categories', path: '/categorias', label: 'Categorias', icon: Briefcase, module: 'professional_categories', group: 'tables' },
  { id: 'companies', path: '/empresas', label: 'Empresas', icon: Building2, module: 'companies', group: 'tables' },
  // Admin group
  { id: 'users', path: '/usuarios', label: 'Usuários', icon: UserCog, module: 'users', group: 'admin', keywords: 'usuarios' },
  { id: 'history', path: '/historico', label: 'Histórico', icon: Clock, module: 'schedules', group: 'admin', keywords: 'historico' },
  { id: 'reports', path: '/relatorios', label: 'Relatórios', icon: BarChart3, module: 'reports', group: 'admin', keywords: 'relatorios' },
];

const ADMIN_ONLY = new Set([
  'users',
  'history',
  'departments',
  'categories',
  // 'companies' removido: agora qualquer role com permissão de read+create/update
  // pode acessar (controle real fica na permission, não no menu).
  'establishments',
  'timesheet-clock',
  'punch-mirror',
  'punch-adjustments',
  'hour-bank',
  'fiscal-exports',
]);

const GROUP_ICONS: Record<string, typeof Calendar> = {
  schedule: Calendar,
  'rep-p': Shield,
  tables: Database,
  admin: UserCog,
};

const STORAGE_KEY_COLLAPSED = 'medscale.sidebar.collapsedGroups';

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function getInitials(text: string | undefined | null): string {
  if (!text) return '?';
  const parts = text.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  Administrador: 'bg-purple-100 text-purple-700 ring-purple-200',
  Gestor: 'bg-blue-100 text-blue-700 ring-blue-200',
  Coordenador: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  Visualizador: 'bg-gray-100 text-gray-700 ring-gray-200',
};

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentView = (() => {
    // 1) Itens com casador customizado ganham prioridade (ex.: as 3 camadas da escala,
    // que compartilham o mesmo pathname e distinguem-se por query ou por segmento do path).
    const withMatcher = MENU_ITEMS.find(m => m.matches?.(location.pathname, location.search));
    if (withMatcher) return withMatcher.id;
    // 2) Fallback: casa pelo path como antes, sempre pelo mais longo.
    const sorted = [...MENU_ITEMS]
      .filter(m => !m.matches)
      .map(m => ({ m, pathOnly: m.path.split('?')[0] }))
      .sort((a, b) => b.pathOnly.length - a.pathOnly.length);
    const match = sorted.find(({ pathOnly }) =>
      location.pathname === pathOnly || location.pathname.startsWith(pathOnly + '/')
    );
    return match?.m.id ?? '';
  })();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COLLAPSED);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const { signOut, user } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (pwNew.length < 6) {
      setPwMsg({ type: 'err', text: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwMsg({ type: 'err', text: 'As senhas não coincidem.' });
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwNew });
      if (error) throw error;
      setPwMsg({ type: 'ok', text: 'Senha alterada com sucesso!' });
      setPwNew('');
      setPwConfirm('');
      setTimeout(() => {
        setShowChangePassword(false);
        setPwMsg(null);
      }, 1500);
    } catch (err: any) {
      setPwMsg({ type: 'err', text: 'Erro: ' + (err.message ?? 'tente novamente') });
    } finally {
      setPwLoading(false);
    }
  };
  const { canRead, isAdmin, roleName, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(Array.from(collapsedGroups)));
    } catch {
      /* ignore */
    }
  }, [collapsedGroups]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [currentView]);

  // Handle Escape key on mobile drawer
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  const visibleItems = useMemo(() => {
    if (permissionsLoading) return [];
    return MENU_ITEMS.filter(item => {
      if (item.onlyForRole && item.onlyForRole !== roleName) return false;
      if (item.hiddenForRoles && roleName && item.hiddenForRoles.includes(roleName)) return false;
      if (ADMIN_ONLY.has(item.id)) return isAdmin();
      return canRead(item.module);
    });
  }, [permissionsLoading, isAdmin, canRead, roleName]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return visibleItems;
    const q = normalize(search);
    return visibleItems.filter(
      item =>
        normalize(item.label).includes(q) ||
        (item.keywords && normalize(item.keywords).includes(q))
    );
  }, [visibleItems, search]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, MenuItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return groups;
  }, [filteredItems]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const userDisplayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Usuário';

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">MedScale</h1>
            <p className="text-xs text-gray-500">Sistema de Escalas</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pb-3 flex-shrink-0">
        <label className="relative block">
          <span className="sr-only">Buscar no menu</span>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar menu..."
            className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </label>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Navegação principal"
        className="flex-1 overflow-y-auto px-3 pb-4 space-y-4"
      >
        {permissionsLoading ? (
          <div className="px-2 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-gray-100 rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-gray-500">Nenhum item encontrado</p>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
              >
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          MENU_GROUPS.map(group => {
            const items = groupedItems[group.id];
            if (!items || items.length === 0) return null;
            const GroupIcon = GROUP_ICONS[group.id];
            const isCollapsed = collapsedGroups.has(group.id) && !search;

            return (
              <div key={group.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors group"
                  aria-expanded={!isCollapsed}
                >
                  {GroupIcon && <GroupIcon className="w-3.5 h-3.5" aria-hidden="true" />}
                  <span className="flex-1 text-left">{group.label}</span>
                  {!search && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                  )}
                </button>
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {items.map(item => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      const accent = ACCENT_CLASSES[item.accent ?? 'blue'];
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            navigate(
                              item.scheduleMode
                                ? scheduleModeTarget(item.scheduleMode, location.pathname, location.search)
                                : item.path
                            )
                          }
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                            isActive
                              ? `${accent.bg} ${accent.text}`
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          {isActive && (
                            <span
                              className={`absolute left-0 top-2 bottom-2 w-1 ${accent.bar} rounded-r-full`}
                              aria-hidden="true"
                            />
                          )}
                          <Icon
                            className={`flex-shrink-0 w-5 h-5 ${
                              isActive ? accent.icon : 'text-gray-500'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* User card + logout */}
      <div className="border-t border-gray-200 p-3 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold ring-2 ring-white shadow">
            {getInitials(userDisplayName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" title={userDisplayName}>
              {userDisplayName}
            </p>
            {roleName && (
              <span
                className={`inline-flex items-center px-1.5 py-0.5 mt-0.5 rounded text-[10px] font-semibold ring-1 ring-inset ${
                  ROLE_BADGE_STYLES[roleName] ?? 'bg-gray-100 text-gray-700 ring-gray-200'
                }`}
              >
                {roleName}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowChangePassword(true); setPwMsg(null); setPwNew(''); setPwConfirm(''); }}
          className="w-full min-h-[40px] flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        >
          <KeyRound className="w-4 h-4" aria-hidden="true" />
          <span>Trocar Senha</span>
        </button>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            // Garantia extra: força redirecionamento mesmo se onAuthStateChange
            // não disparar (algumas combinações de rede + storage podem segurar
            // o estado React em "user" antigo).
            navigate('/login', { replace: true });
          }}
          className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          <span>Sair</span>
        </button>
      </div>

      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <KeyRound className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900">Trocar Senha</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Defina uma nova senha (mínimo 6 caracteres).
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  autoFocus
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  autoComplete="new-password"
                />
              </div>
            </div>
            {pwMsg && (
              <div className={`mt-3 px-3 py-2 rounded-lg text-sm ${
                pwMsg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {pwMsg.text}
              </div>
            )}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowChangePassword(false)}
                disabled={pwLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwLoading || !pwNew || !pwConfirm}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium disabled:opacity-50"
              >
                {pwLoading ? 'Salvando...' : 'Trocar Senha'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex bg-white border-r border-gray-200 transition-[width] duration-300 ease-in-out flex-col overflow-hidden ${
          sidebarOpen ? 'w-64' : 'w-0'
        }`}
        aria-label="Barra lateral"
      >
        {sidebarOpen && <div className="w-64 flex flex-col h-full">{sidebarContent}</div>}
      </aside>

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
        <aside
          className={`absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-label="Menu"
        >
          {sidebarContent}
        </aside>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 1024) setMobileOpen(prev => !prev);
                else setSidebarOpen(prev => !prev);
              }}
              aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
              className="w-11 h-11 -ml-1 flex items-center justify-center text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(sidebarOpen && window.innerWidth >= 1024) || mobileOpen ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
              )}
            </button>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">Sistema de Gestão</p>
                <p className="text-xs text-gray-500">
                  {new Date().toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div
                className="lg:hidden w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold"
                title={userDisplayName}
                aria-label={`Logado como ${userDisplayName}`}
              >
                {getInitials(userDisplayName)}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
