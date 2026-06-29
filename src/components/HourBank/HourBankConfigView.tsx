import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, Save, Info, Clock, Calendar, DollarSign, AlertTriangle, Moon } from 'lucide-react';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface HourBankConfig {
  id: string;
  company_id: string | null;
  agreement_type: string;
  compensation_period_months: number;
  daily_overtime_limit_minutes: number;
  weekly_overtime_limit_minutes: number;
  monthly_overtime_limit_minutes: number;
  overtime_multiplier: number;
  sunday_multiplier: number;
  holiday_multiplier: number;
  night_shift_multiplier: number;
  night_shift_start: string;
  night_shift_end: string;
  allow_negative_balance: boolean;
  max_negative_balance_minutes: number;
  auto_calculate: boolean;
  expiration_warning_days: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

interface Company {
  id: string;
  name: string;
}

const defaultConfig: Omit<HourBankConfig, 'id'> = {
  company_id: null,
  agreement_type: 'individual',
  compensation_period_months: 6,
  daily_overtime_limit_minutes: 120,
  weekly_overtime_limit_minutes: 600,
  monthly_overtime_limit_minutes: 2400,
  overtime_multiplier: 1.50,
  sunday_multiplier: 2.00,
  holiday_multiplier: 2.00,
  night_shift_multiplier: 1.20,
  night_shift_start: '22:00',
  night_shift_end: '05:00',
  allow_negative_balance: true,
  max_negative_balance_minutes: 480,
  auto_calculate: true,
  expiration_warning_days: 30,
  is_active: true,
};

export function HourBankConfigView() {
  const { toasts, toast, removeToast } = useToast();
  const [config, setConfig] = useState<HourBankConfig | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState<Omit<HourBankConfig, 'id'>>(defaultConfig);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadConfig(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name')
      .eq('active', true)
      .order('name');

    if (data && data.length > 0) {
      setCompanies(data);
      setSelectedCompanyId(data[0].id);
    }
    setLoading(false);
  };

  const loadConfig = async (companyId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hour_bank_config')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) {
      console.error('Error loading config:', error);
      toast.error('Erro ao carregar configuração do banco de horas.');
      setLoading(false);
      return;
    }
    if (data) {
      setConfig(data);
      setFormData(data);
    } else {
      setConfig(null);
      setFormData({ ...defaultConfig, company_id: companyId });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const dataToSave = {
        ...formData,
        company_id: selectedCompanyId,
        updated_at: new Date().toISOString(),
      };

      if (config?.id) {
        const { error } = await supabase
          .from('hour_bank_config')
          .update(dataToSave)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('hour_bank_config')
          .insert(dataToSave);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'Configuracoes salvas com sucesso!' });
      loadConfig(selectedCompanyId);
    } catch (err) {
      console.error('Error saving config:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar configuracoes.' });
    } finally {
      setSaving(false);
    }
  };

  const formatMinutesToHours = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  };

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-semibold text-gray-900">Configuracoes do Banco de Horas</h2>
        </div>
        {companies.length > 1 && (
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Legislacao Brasileira - CLT Art. 59</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Acordo individual: compensacao em ate 6 meses</li>
            <li>Acordo coletivo: compensacao em ate 1 ano</li>
            <li>Acordo mensal: compensacao no mesmo mes</li>
            <li>Limite de 2 horas extras por dia (10h totais)</li>
            <li>Horas nao compensadas: pagas com adicional minimo de 50%</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">Tipo de Acordo</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Acordo</label>
              <select
                value={formData.agreement_type}
                onChange={(e) => {
                  const type = e.target.value as 'individual' | 'coletivo' | 'mensal';
                  let period: 1 | 6 | 12 = 6;
                  if (type === 'mensal') period = 1;
                  else if (type === 'coletivo') period = 12;
                  setFormData({ ...formData, agreement_type: type, compensation_period_months: period });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="individual">Individual (ate 6 meses)</option>
                <option value="coletivo">Coletivo/Convencao (ate 12 meses)</option>
                <option value="mensal">Mensal (compensacao no mes)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Periodo de Compensacao</label>
              <select
                value={formData.compensation_period_months}
                onChange={(e) => setFormData({ ...formData, compensation_period_months: parseInt(e.target.value) as 1 | 6 | 12 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                disabled={formData.agreement_type === 'mensal'}
              >
                <option value={1}>1 mes</option>
                <option value={6} disabled={formData.agreement_type === 'mensal'}>6 meses</option>
                <option value={12} disabled={formData.agreement_type !== 'coletivo'}>12 meses</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Alerta de Vencimento (dias antes)</label>
              <input
                type="number"
                value={formData.expiration_warning_days}
                onChange={(e) => setFormData({ ...formData, expiration_warning_days: parseInt(e.target.value) || 30 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                min={1}
                max={90}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">Banco de horas ativo</label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto_calculate"
                checked={formData.auto_calculate}
                onChange={(e) => setFormData({ ...formData, auto_calculate: e.target.checked })}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="auto_calculate" className="text-sm text-gray-700">Calcular automaticamente do ponto</label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">Limites de Horas Extras</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limite Diario (minutos)
                <span className="text-gray-500 font-normal ml-2">= {formatMinutesToHours(formData.daily_overtime_limit_minutes)}</span>
              </label>
              <input
                type="number"
                value={formData.daily_overtime_limit_minutes}
                onChange={(e) => setFormData({ ...formData, daily_overtime_limit_minutes: parseInt(e.target.value) || 120 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                min={0}
                max={240}
              />
              <p className="text-xs text-gray-500 mt-1">CLT: maximo 2h/dia (120 min)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limite Semanal (minutos)
                <span className="text-gray-500 font-normal ml-2">= {formatMinutesToHours(formData.weekly_overtime_limit_minutes)}</span>
              </label>
              <input
                type="number"
                value={formData.weekly_overtime_limit_minutes}
                onChange={(e) => setFormData({ ...formData, weekly_overtime_limit_minutes: parseInt(e.target.value) || 600 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                min={0}
                max={1200}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limite Mensal (minutos)
                <span className="text-gray-500 font-normal ml-2">= {formatMinutesToHours(formData.monthly_overtime_limit_minutes)}</span>
              </label>
              <input
                type="number"
                value={formData.monthly_overtime_limit_minutes}
                onChange={(e) => setFormData({ ...formData, monthly_overtime_limit_minutes: parseInt(e.target.value) || 2400 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                min={0}
                max={4800}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">Multiplicadores</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Extra Normal
                <span className="text-gray-500 font-normal ml-2">({((formData.overtime_multiplier - 1) * 100).toFixed(0)}% adicional)</span>
              </label>
              <input
                type="number"
                value={formData.overtime_multiplier}
                onChange={(e) => setFormData({ ...formData, overtime_multiplier: Math.max(1.5, parseFloat(e.target.value) || 1.5) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                min={1.5}
                max={3}
                step={0.05}
              />
              <p className="text-xs text-gray-500 mt-1">CLT: minimo 50% (1.50x)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Domingo
                <span className="text-gray-500 font-normal ml-2">({((formData.sunday_multiplier - 1) * 100).toFixed(0)}% adicional)</span>
              </label>
              <input
                type="number"
                value={formData.sunday_multiplier}
                onChange={(e) => setFormData({ ...formData, sunday_multiplier: Math.max(1, parseFloat(e.target.value) || 2) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                min={1}
                max={3}
                step={0.05}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feriado
                <span className="text-gray-500 font-normal ml-2">({((formData.holiday_multiplier - 1) * 100).toFixed(0)}% adicional)</span>
              </label>
              <input
                type="number"
                value={formData.holiday_multiplier}
                onChange={(e) => setFormData({ ...formData, holiday_multiplier: Math.max(1, parseFloat(e.target.value) || 2) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                min={1}
                max={3}
                step={0.05}
              />
              <p className="text-xs text-gray-500 mt-1">Recomendado: 100% (2.00x)</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Moon className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-gray-900">Adicional Noturno</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Multiplicador Noturno
                <span className="text-gray-500 font-normal ml-2">({((formData.night_shift_multiplier - 1) * 100).toFixed(0)}% adicional)</span>
              </label>
              <input
                type="number"
                value={formData.night_shift_multiplier}
                onChange={(e) => setFormData({ ...formData, night_shift_multiplier: Math.max(1, parseFloat(e.target.value) || 1.2) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                min={1}
                max={2}
                step={0.05}
              />
              <p className="text-xs text-gray-500 mt-1">CLT: minimo 20% (1.20x)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Inicio do Noturno</label>
                <input
                  type="time"
                  value={formData.night_shift_start}
                  onChange={(e) => setFormData({ ...formData, night_shift_start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fim do Noturno</label>
                <input
                  type="time"
                  value={formData.night_shift_end}
                  onChange={(e) => setFormData({ ...formData, night_shift_end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">CLT: 22h as 5h (urbano)</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-gray-900">Saldo Negativo (Devedor)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="allow_negative"
                checked={formData.allow_negative_balance}
                onChange={(e) => setFormData({ ...formData, allow_negative_balance: e.target.checked })}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
              />
              <label htmlFor="allow_negative" className="text-sm text-gray-700">
                Permitir saldo negativo (funcionario deve horas)
              </label>
            </div>

            {formData.allow_negative_balance && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Limite Maximo Negativo (minutos)
                  <span className="text-gray-500 font-normal ml-2">= {formatMinutesToHours(formData.max_negative_balance_minutes)}</span>
                </label>
                <input
                  type="number"
                  value={formData.max_negative_balance_minutes}
                  onChange={(e) => setFormData({ ...formData, max_negative_balance_minutes: parseInt(e.target.value) || 480 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  min={0}
                  max={2400}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Configuracoes'}
        </button>
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
