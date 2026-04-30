import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/Common/ErrorBoundary';
import LoginForm from './components/Auth/LoginForm';
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
// Heavy: loads face-api.js (~16MB) — only when actually accessed
const TimesheetClockView = lazy(() => import('./components/Timesheet/TimesheetClockView'));
const TimesheetReportView = lazy(() => import('./components/Timesheet/TimesheetReportView'));
const PunchMirrorView = lazy(() => import('./components/Timesheet/PunchMirrorView'));
const PunchAdjustmentsView = lazy(() => import('./components/Timesheet/PunchAdjustmentsView'));

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

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('schedule');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  if (loading) return <AppLoadingScreen />;
  if (!user) return <LoginForm />;

  const handleNavigateToSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setCurrentView('consolidated');
  };

  return (
    <DashboardLayout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'schedule' && (
        <ScheduleView onNavigateToSchedule={handleNavigateToSchedule} />
      )}
      {currentView === 'consolidated' && (
        <ConsolidatedScheduleView initialScheduleId={selectedScheduleId} />
      )}
      {currentView === 'daily' && <DailyScheduleView />}
      {currentView === 'professionals' && <ProfessionalsView />}
      {currentView === 'swaps' && (
        <ViewSuspense>
          <SwapsView />
        </ViewSuspense>
      )}
      {currentView === 'absenteeism' && (
        <ViewSuspense>
          <AbsenteeismView />
        </ViewSuspense>
      )}
      {currentView === 'timesheet-clock' && (
        <ViewSuspense>
          <TimesheetClockView />
        </ViewSuspense>
      )}
      {currentView === 'timesheet-report' && (
        <ViewSuspense>
          <TimesheetReportView />
        </ViewSuspense>
      )}
      {currentView === 'punch-mirror' && (
        <ViewSuspense>
          <PunchMirrorView />
        </ViewSuspense>
      )}
      {currentView === 'punch-adjustments' && (
        <ViewSuspense>
          <PunchAdjustmentsView />
        </ViewSuspense>
      )}
      {currentView === 'establishments' && (
        <ViewSuspense>
          <EstablishmentsView />
        </ViewSuspense>
      )}
      {currentView === 'fiscal-exports' && (
        <ViewSuspense>
          <FiscalExportsView />
        </ViewSuspense>
      )}
      {currentView === 'hour-bank' && (
        <ViewSuspense>
          <HourBankView />
        </ViewSuspense>
      )}
      {currentView === 'departments' && (
        <ViewSuspense>
          <DepartmentsView />
        </ViewSuspense>
      )}
      {currentView === 'categories' && (
        <ViewSuspense>
          <CategoriesView />
        </ViewSuspense>
      )}
      {currentView === 'companies' && (
        <ViewSuspense>
          <CompaniesView />
        </ViewSuspense>
      )}
      {currentView === 'users' && (
        <ViewSuspense>
          <UsersView />
        </ViewSuspense>
      )}
      {currentView === 'history' && (
        <ViewSuspense>
          <HistoryView />
        </ViewSuspense>
      )}
      {currentView === 'reports' && (
        <ViewSuspense>
          <ReportsView />
        </ViewSuspense>
      )}
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
