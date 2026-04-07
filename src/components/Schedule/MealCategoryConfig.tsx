import { useState, useEffect } from 'react';
import { Settings, Check, X, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';

interface Category {
  id: string;
  name: string;
  has_meal_benefit?: boolean;
  config_id?: string;
  notes?: string;
}

interface MealCategoryConfigProps {
  onClose: () => void;
}

export default function MealCategoryConfig({ onClose }: MealCategoryConfigProps) {
  const { toasts, toast, removeToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);

      const { data: categoriesData, error: catError } = await supabase
        .from('professional_categories')
        .select('id, name')
        .order('name');

      if (catError) throw catError;

      const { data: configData, error: configError } = await supabase
        .from('meal_category_config')
        .select('*');

      if (configError) throw configError;

      const configMap = new Map(
        configData?.map(c => [c.category_id, c]) || []
      );

      const categoriesWithConfig = categoriesData?.map(cat => ({
        ...cat,
        has_meal_benefit: configMap.get(cat.id)?.has_meal_benefit || false,
        config_id: configMap.get(cat.id)?.id,
        notes: configMap.get(cat.id)?.notes || '',
      })) || [];

      setCategories(categoriesWithConfig);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
      toast.error('Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (categoryId: string) => {
    setCategories(prev => prev.map(cat =>
      cat.id === categoryId
        ? { ...cat, has_meal_benefit: !cat.has_meal_benefit }
        : cat
    ));
  };

  const handleNotesChange = (categoryId: string, notes: string) => {
    setCategories(prev => prev.map(cat =>
      cat.id === categoryId ? { ...cat, notes } : cat
    ));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const category of categories) {
        if (category.config_id) {
          const { error } = await supabase
            .from('meal_category_config')
            .update({
              has_meal_benefit: category.has_meal_benefit,
              notes: category.notes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', category.config_id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('meal_category_config')
            .insert({
              category_id: category.id,
              has_meal_benefit: category.has_meal_benefit,
              notes: category.notes,
            });

          if (error) throw error;
        }
      }

      toast.success('Configurações salvas com sucesso!');
      onClose();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Carregando...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Configuração de Refeições por Categoria
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Defina quais categorias têm direito a refeições
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Regras HECC/FESF</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Jornada ≤ 6h: 0 refeições</li>
              <li>• Jornada 8h: 1 refeição (almoço)</li>
              <li>• Plantão 12h Diurno (SD): 1 refeição (almoço)</li>
              <li>• Plantão 12h Noturno (SN): 2 refeições (ceia + desjejum)</li>
              <li>• Plantão 24h: 4 refeições (almoço + jantar + ceia + desjejum)</li>
            </ul>
          </div>

          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
              >
                <div className="flex items-start gap-4">
                  <button
                    onClick={() => handleToggle(category.id)}
                    className={`flex-shrink-0 mt-1 w-12 h-6 rounded-full transition-colors duration-200 ${
                      category.has_meal_benefit
                        ? 'bg-green-500'
                        : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                        category.has_meal_benefit
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {category.name}
                      </h4>
                      {category.has_meal_benefit ? (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          <Check className="w-3 h-3" />
                          Com direito
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          <X className="w-3 h-3" />
                          Sem direito
                        </span>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Observações (opcional)"
                      value={category.notes}
                      onChange={(e) => handleNotesChange(category.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
