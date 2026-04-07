import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/Common/ErrorBoundary';
import LoginForm from './components/Auth/LoginForm';
import DashboardLayout from './components/Dashboard/DashboardLayout';
import ScheduleView from './components/Schedule/ScheduleView';
import ConsolidatedScheduleView from './components/Schedule/ConsolidatedScheduleView';
import DailyScheduleView from './components/Schedule/DailyScheduleView';
import ProfessionalsView from './components/Professionals/ProfessionalsView';
import SwapsView from './components/Swaps/SwapsView';
import DepartmentsView from './components/Departments/DepartmentsView';
import CategoriesView from './components/Tables/CategoriesView';
import CompaniesView from './components/Tables/CompaniesView';
import UsersView from './components/Users/UsersView';
import HistoryView from './components/History/HistoryView';
import ReportsView from './components/Reports/ReportsView';
import TimesheetClockView from './components/Timesheet/TimesheetClockView';
import TimesheetReportView from './components/Timesheet/TimesheetReportView';
import PunchMirrorView from './components/Timesheet/PunchMirrorView';
import PunchAdjustmentsView from './components/Timesheet/PunchAdjustmentsView';
import EstablishmentsView from './components/Establishments/EstablishmentsView';
import FiscalExportsView from './components/Reports/FiscalExportsView';
import { HourBankView } from './components/HourBank/HourBankView';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('schedule');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const handleNavigateToSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setCurrentView('consolidated');
  };

  return (
    <DashboardLayout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'schedule' && <ScheduleView onNavigateToSchedule={handleNavigateToSchedule} />}
      {currentView === 'consolidated' && <ConsolidatedScheduleView initialScheduleId={selectedScheduleId} />}
      {currentView === 'daily' && <DailyScheduleView />}
      {currentView === 'professionals' && <ProfessionalsView />}
      {currentView === 'swaps' && <SwapsView />}
      {currentView === 'timesheet-clock' && <TimesheetClockView />}
      {currentView === 'timesheet-report' && <TimesheetReportView />}
      {currentView === 'punch-mirror' && <PunchMirrorView />}
      {currentView === 'punch-adjustments' && <PunchAdjustmentsView />}
      {currentView === 'establishments' && <EstablishmentsView />}
      {currentView === 'fiscal-exports' && <FiscalExportsView />}
      {currentView === 'hour-bank' && <HourBankView />}
      {currentView === 'departments' && <DepartmentsView />}
      {currentView === 'categories' && <CategoriesView />}
      {currentView === 'companies' && <CompaniesView />}
      {currentView === 'users' && <UsersView />}
      {currentView === 'history' && <HistoryView />}
      {currentView === 'reports' && <ReportsView />}
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
