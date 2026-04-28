import { useState } from 'react';
import { X, Zap, Calendar, Clock } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';

interface Professional {
  id: string;
  full_name: string;
  category: { name: string };
}

interface AutoFillModalProps {
  isOpen: boolean;
  onClose: () => void;
  professionals: Professional[];
  onApply: (configs: ScaleConfig[]) => void;
}

export interface ScaleConfig {
  professionalId: string;
  pattern: '12x36-day' | '12x36-night' | '24x48' | 'admin-morning' | 'admin-afternoon' | 'admin-full';
  startDay: number;
}

const PATTERNS = [
  {
    id: '12x36-day',
    name: 'Plantão 12x36 Diurno',
    description: 'Trabalha 12h diurnas, folga 36h (SD no dia, FG nos próximos 2 dias)',
    shift: 'SD',
    icon: '☀️',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100'
  },
  {
    id: '12x36-night',
    name: 'Plantão 12x36 Noturno',
    description: 'Trabalha 12h noturnas, folga 36h (SN no dia, FG nos próximos 2 dias)',
    shift: 'SN',
    icon: '🌙',
    color: 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
  },
  {
    id: '24x48',
    name: 'Plantão 24x48',
    description: 'Trabalha 24h, folga 48h (P no dia, FG nos próximos 2 dias)',
    shift: 'P',
    icon: '⏰',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100'
  },
  {
    id: 'admin-morning',
    name: 'Administrativo Manhã',
    description: 'Segunda a Sexta, turno manhã (M)',
    shift: 'M',
    icon: '🌅',
    color: 'bg-green-50 border-green-200 hover:bg-green-100'
  },
  {
    id: 'admin-afternoon',
    name: 'Administrativo Tarde',
    description: 'Segunda a Sexta, turno tarde (T)',
    shift: 'T',
    icon: '🌆',
    color: 'bg-orange-50 border-orange-200 hover:bg-orange-100'
  },
  {
    id: 'admin-full',
    name: 'Administrativo Integral',
    description: 'Segunda a Sexta, manhã e tarde (MT)',
    shift: 'MT',
    icon: '📋',
    color: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100'
  }
];

export default function AutoFillModal({ isOpen, onClose, professionals, onApply }: AutoFillModalProps) {
  const { toasts, toast, removeToast } = useToast();
  const [configs, setConfigs] = useState<Map<string, { pattern: string; startDay: number }>>(new Map());

  if (!isOpen) return null;

  const handlePatternChange = (profId: string, pattern: string) => {
    const newConfigs = new Map(configs);
    const current = newConfigs.get(profId) || { pattern: '', startDay: 1 };
    newConfigs.set(profId, { ...current, pattern });
    setConfigs(newConfigs);
  };

  const handleStartDayChange = (profId: string, startDay: number) => {
    const newConfigs = new Map(configs);
    const current = newConfigs.get(profId) || { pattern: '', startDay: 1 };
    newConfigs.set(profId, { ...current, startDay });
    setConfigs(newConfigs);
  };

  const handleApply = () => {
    const validConfigs: ScaleConfig[] = [];
    configs.forEach((config, professionalId) => {
      if (config.pattern) {
        validConfigs.push({
          professionalId,
          pattern: config.pattern as any,
          startDay: config.startDay
        });
      }
    });

    if (validConfigs.length === 0) {
      toast.warning('Selecione ao menos um profissional e padrão de escala');
      return;
    }

    onApply(validConfigs);
  };

  const selectedCount = Array.from(configs.values()).filter(c => c.pattern).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Preenchimento Automático Inteligente</h2>
              <p className="text-sm text-gray-600 mt-0.5">Configure padrões de escala por profissional</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Padrões Disponíveis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
              {PATTERNS.map(pattern => (
                <div key={pattern.id} className="flex items-start gap-2">
                  <span className="text-lg">{pattern.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{pattern.name}</p>
                    <p className="text-xs text-gray-600">{pattern.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                Configurar Profissionais ({selectedCount} selecionados)
              </h3>
            </div>

            {professionals.map(prof => {
              const config = configs.get(prof.id);
              const selectedPattern = PATTERNS.find(p => p.id === config?.pattern);

              return (
                <div
                  key={prof.id}
                  className={`border rounded-lg p-4 transition-all ${
                    config?.pattern
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{prof.full_name}</p>
                      <p className="text-sm text-gray-600">{prof.category?.name}</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 lg:w-2/3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Padrão de Escala
                        </label>
                        <select
                          value={config?.pattern || ''}
                          onChange={(e) => handlePatternChange(prof.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">Selecione...</option>
                          {PATTERNS.map(pattern => (
                            <option key={pattern.id} value={pattern.id}>
                              {pattern.icon} {pattern.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {config?.pattern && (config.pattern.includes('12x36') || config.pattern === '24x48') && (
                        <div className="w-32">
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Inicia no Dia
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={config.startDay}
                            onChange={(e) => handleStartDayChange(prof.id, parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      )}
                    </div>

                    {selectedPattern && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 lg:w-48">
                        <Clock className="w-4 h-4" />
                        <span>{selectedPattern.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {professionals.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum profissional na escala</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={selectedCount === 0}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Aplicar Preenchimento Automático
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
