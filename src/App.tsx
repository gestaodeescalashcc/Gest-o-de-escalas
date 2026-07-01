import { lazy, Suspense } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { usePermissions } from './hooks/usePermissions';
import ErrorBoundary from './components/Common/ErrorBoundary';
import LoginForm from './components/Auth/LoginForm';
import DoctorSignupForm from './components/Auth/DoctorSignupForm';
import DashboardLayout from './components/Dashboard/DashboardLayout';
import { PageSkeleton } from './components/Common/Skeleton';
import { Calendar } from 'lucide-react';

// Eagerly load only the most-used views (initial UX)
import ScheduleView from './components/Schedule/ScheduleView';
import ConsolidatedScheduleView from './components/Schedule/ConsolidatedScheduleView';
import DailyScheduleView from './components/Schedule/DailyScheduleView';
import ProfessionalsView from './components/Professionals/ProfessionalsView';

// Lazy load heavier / less-frequent views
const SwapsView = lazy(() => import('./components/Swaps/SwapsView'));
const AbsenteeismView = lazy(() => import('./components/Absenteeism/AbsenteeismView'));
const DepartmentsView = lazy(() => import('./components/Departments/DepartmentsView'));
const CategoriesView = lazy(() => import('./components/Tables/CategoriesView'));
const CompaniesView = lazy(() => import('./components/Tables/CompaniesView'));
const UsersView = lazy(() => import('./components/Users/UsersView'));
const HistoryView = lazy(() => import('./components/History/HistoryView'));
const ReportsView = lazy(() => import('./components/Reports/ReportsView'));
const EstablishmentsView = lazy(() => import('./components/Establishments/EstablishmentsView'));
const FiscalExportsView = lazy(() => import('./components/Reports/FiscalExportsView'));
const HourBankView = lazy(() =>
  import('./components/HourBank/HourBankView').then(m => ({ default: m.HourBankView }))
);
const TimesheetClockView = lazy(() => import('./components/Timesheet/TimesheetClockView'));
const TimesheetReportView = lazy(() => import('./components/Timesheet/TimesheetReportView'));
const PunchMirrorView = lazy(() => import('./components/Timesheet/PunchMirrorView'));
const PunchAdjustmentsView = lazy(() => import('./components/Timesheet/PunchAdjustmentsView'));
const MyScheduleView = lazy(() => import('./components/Schedule/MyScheduleView'));

function AppLoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/30 mb-4 animate-pulse">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <p className="text-gray-700 font-medium">Carregando MedScale...</p>
        <p className="text-gray-500 text-sm mt-1">Preparando seu ambiente</p>
      </div>
    </div>
  );
}

function ViewSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton variant="table" />}>{children}</Suspense>;
}

const SCHEDULE_MODES = ['planejada', 'troca', 'realizada'] as const;
type ScheduleMode = (typeof SCHEDULE_MODES)[number];

function readModeFromQuery(search: string): ScheduleMode {
  const raw = new URLSearchParams(search).get('modo');
  return raw && (SCHEDULE_MODES as readonly string[]).includes(raw)
    ? (raw as ScheduleMode)
    : 'planejada';
}

// Wrapper components to bridge the old prop-callback API with React Router navigation
function ScheduleListRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = readModeFromQuery(location.search);
  // Preserva o modo escolhido pela sidebar quando o usuário abre uma escala da lista.
  return <ScheduleView onNavigateToSchedule={(id) => navigate(`/escala/${id}/${mode}`)} />;
}

function ScheduleDetailRoute() {
  const { scheduleId, modo } = useParams<{ scheduleId: string; modo: string }>();
  const navigate = useNavigate();
  const mode: ScheduleMode =
    modo && (SCHEDULE_MODES as readonly string[]).includes(modo)
      ? (modo as ScheduleMode)
      : 'planejada';
  return (
    <ConsolidatedScheduleView
      initialScheduleId={scheduleId}
      mode={mode}
      onBackToList={() => navigate(`/escala?modo=${mode}`)}
    />
  );
}

function LoginRoute() {
  const navigate = useNavigate();
  return <LoginForm onSignupClick={() => navigate('/cadastro-medico')} />;
}

function SignupRoute() {
  const navigate = useNavigate();
  return <DoctorSignupForm onBackToLogin={() => navigate('/login')} />;
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AppLoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppLoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Redireciona para a tela inicial certa baseada na role:
// - Médico → /minha-escala (foco em ver os próprios plantões e trocar)
// - Demais → /escala (visão de gestão)
function RoleBasedRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { roleName, loading: permLoading } = usePermissions();
  if (authLoading || permLoading) return <AppLoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleName === 'Médico' ? '/minha-escala' : '/escala'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicOnly><LoginRoute /></PublicOnly>} />
      <Route path="/cadastro-medico" element={<PublicOnly><SignupRoute /></PublicOnly>} />

      {/* Protected */}
      <Route path="/minha-escala" element={<ProtectedLayout><ViewSuspense><MyScheduleView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/escala" element={<ProtectedLayout><ScheduleListRoute /></ProtectedLayout>} />
      <Route path="/escala/:scheduleId" element={<Navigate to="planejada" replace />} />
      <Route path="/escala/:scheduleId/:modo" element={<ProtectedLayout><ScheduleDetailRoute /></ProtectedLayout>} />
      <Route path="/escala-diaria" element={<ProtectedLayout><DailyScheduleView /></ProtectedLayout>} />
      <Route path="/profissionais" element={<ProtectedLayout><ProfessionalsView /></ProtectedLayout>} />

      <Route path="/trocas" element={<ProtectedLayout><ViewSuspense><SwapsView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/absenteismo" element={<ProtectedLayout><ViewSuspense><AbsenteeismView /></ViewSuspense></ProtectedLayout>} />

      <Route path="/ponto/registro" element={<ProtectedLayout><ViewSuspense><TimesheetClockView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/ponto/relatorio" element={<ProtectedLayout><ViewSuspense><TimesheetReportView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/ponto/espelho" element={<ProtectedLayout><ViewSuspense><PunchMirrorView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/ponto/ajustes" element={<ProtectedLayout><ViewSuspense><PunchAdjustmentsView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/ponto/banco-horas" element={<ProtectedLayout><ViewSuspense><HourBankView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/ponto/exportacoes" element={<ProtectedLayout><ViewSuspense><FiscalExportsView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/ponto/estabelecimentos" element={<ProtectedLayout><ViewSuspense><EstablishmentsView /></ViewSuspense></ProtectedLayout>} />

      <Route path="/setores" element={<ProtectedLayout><ViewSuspense><DepartmentsView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/categorias" element={<ProtectedLayout><ViewSuspense><CategoriesView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/empresas" element={<ProtectedLayout><ViewSuspense><CompaniesView /></ViewSuspense></ProtectedLayout>} />

      <Route path="/usuarios" element={<ProtectedLayout><ViewSuspense><UsersView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/historico" element={<ProtectedLayout><ViewSuspense><HistoryView /></ViewSuspense></ProtectedLayout>} />
      <Route path="/relatorios" element={<ProtectedLayout><ViewSuspense><ReportsView /></ViewSuspense></ProtectedLayout>} />

      {/* Legacy / fallback */}
      <Route path="/" element={<RoleBasedRedirect />} />
      <Route path="*" element={<RoleBasedRedirect />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
