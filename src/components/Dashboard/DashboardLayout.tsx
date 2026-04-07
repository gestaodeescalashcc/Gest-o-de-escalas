import { ReactNode, useState } from 'react';
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
  Wallet
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

interface DashboardLayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function DashboardLayout({ children, currentView, onViewChange }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { signOut } = useAuth();
  const { canRead, isAdmin, loading: permissionsLoading } = usePermissions();

  const allMenuItems = [
    { id: 'schedule', label: 'Escalas', icon: Calendar, module: 'schedules' as const },
    { id: 'consolidated', label: 'Escala Consolidada', icon: LayoutGrid, module: 'schedules' as const },
    { id: 'daily', label: 'Escala do Dia', icon: ClipboardList, module: 'schedules' as const },
    { id: 'professionals', label: 'Profissionais', icon: Users, module: 'professionals' as const },
    { id: 'swaps', label: 'Trocas de Plantoes', icon: ArrowLeftRight, module: 'swaps' as const },
    { id: 'rep-p', label: 'REP-P (Ponto)', icon: Shield, module: 'schedules' as const, separator: true, isHeader: true },
    { id: 'timesheet-clock', label: 'Registro de Ponto', icon: Fingerprint, module: 'schedules' as const, indent: true },
    { id: 'punch-mirror', label: 'Espelho de Ponto', icon: FileText, module: 'reports' as const, indent: true },
    { id: 'punch-adjustments', label: 'Ajustes de Ponto', icon: Edit3, module: 'schedules' as const, indent: true },
    { id: 'hour-bank', label: 'Banco de Horas', icon: Wallet, module: 'schedules' as const, indent: true },
    { id: 'fiscal-exports', label: 'Exportacoes Fiscais', icon: FileCheck, module: 'reports' as const, indent: true },
    { id: 'establishments', label: 'Estabelecimentos', icon: Building2, module: 'users' as const, indent: true },
    { id: 'tables', label: 'Tabelas', icon: Database, module: 'departments' as const, separator: true, isHeader: true },
    { id: 'departments', label: 'Setores', icon: Building2, module: 'departments' as const, indent: true },
    { id: 'categories', label: 'Categorias', icon: Briefcase, module: 'professional_categories' as const, indent: true },
    { id: 'companies', label: 'Empresas', icon: Building2, module: 'companies' as const, indent: true },
    { id: 'users', label: 'Usuarios', icon: UserCog, module: 'users' as const, separator: true },
    { id: 'history', label: 'Historico', icon: Clock, module: 'schedules' as const },
    { id: 'reports', label: 'Relatorios', icon: BarChart3, module: 'reports' as const },
  ];

  const adminOnlyMenus = ['users', 'history', 'tables', 'departments', 'categories', 'companies', 'establishments', 'rep-p'];

  const menuItems = permissionsLoading
    ? []
    : allMenuItems.filter(item => {
        if (adminOnlyMenus.includes(item.id)) {
          return isAdmin();
        }
        return canRead(item.module);
      });

  return (
    <div className="flex h-screen bg-gray-50">
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}
      >
        <div className="p-6 flex-shrink-0">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">MedScale</h1>
              <p className="text-xs text-gray-500">Sistema de Escalas</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 px-6 flex-1 overflow-y-auto">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const showSeparator = item.separator && index > 0;
            const isHeader = 'isHeader' in item && item.isHeader;

            return (
              <div key={item.id}>
                {showSeparator && <div className="my-3 border-t border-gray-200" />}
                {isHeader ? (
                  <div className="px-4 py-2 flex items-center gap-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onViewChange(item.id)}
                    className={`w-full flex items-center gap-3 py-3 rounded-lg transition ${
                      item.indent ? 'px-8 text-sm' : 'px-4'
                    } ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </button>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              {sidebarOpen ? (
                <X className="w-6 h-6 text-gray-600" />
              ) : (
                <Menu className="w-6 h-6 text-gray-600" />
              )}
            </button>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Sistema de Gestão</p>
                <p className="text-xs text-gray-500">
                  {new Date().toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
