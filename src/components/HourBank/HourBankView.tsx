import { useState } from 'react';
import { Wallet, Settings, List, RefreshCw, Calendar } from 'lucide-react';
import { HourBankBalanceView } from './HourBankBalanceView';
import { HourBankEntriesView } from './HourBankEntriesView';
import { HourBankCompensationsView } from './HourBankCompensationsView';
import { HourBankConfigView } from './HourBankConfigView';
import { HolidaysView } from './HolidaysView';
import { usePermissions } from '../../hooks/usePermissions';

type TabType = 'balances' | 'entries' | 'compensations' | 'holidays' | 'config';

export function HourBankView() {
  const [activeTab, setActiveTab] = useState<TabType>('balances');
  const { isAdmin: checkIsAdmin } = usePermissions();
  const isAdmin = checkIsAdmin();

  const tabs = [
    { id: 'balances' as const, label: 'Saldos', icon: Wallet },
    { id: 'entries' as const, label: 'Lancamentos', icon: List },
    { id: 'compensations' as const, label: 'Compensacoes', icon: RefreshCw },
    { id: 'holidays' as const, label: 'Feriados', icon: Calendar },
    ...(isAdmin ? [{ id: 'config' as const, label: 'Configuracoes', icon: Settings }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200">
        <nav className="flex space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {activeTab === 'balances' && <HourBankBalanceView />}
        {activeTab === 'entries' && <HourBankEntriesView />}
        {activeTab === 'compensations' && <HourBankCompensationsView />}
        {activeTab === 'holidays' && <HolidaysView />}
        {activeTab === 'config' && isAdmin && <HourBankConfigView />}
      </div>
    </div>
  );
}
