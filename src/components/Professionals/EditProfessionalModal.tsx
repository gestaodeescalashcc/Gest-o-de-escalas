import { useState, useEffect } from 'react';
import { X, User, Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import FaceCaptureModal from '../FacialRecognition/FaceCaptureModal';
import { extractFaceDescriptor, descriptorToArray, loadModels } from '../../services/faceRecognition';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';

interface EditProfessionalModalProps {
  professional: {
    id: string;
    full_name: string;
    cpf?: string | null;
    pis_number?: string | null;
    hire_date?: string | null;
    category_id: string;
    department_id: string;
    company_id?: string;
    registration_number: string | null;
    coren?: string | null;
    phone: string | null;
    email: string | null;
    contracted_hours_per_month?: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditProfessionalModal({ professional, onClose, onSuccess }: EditProfessionalModalProps) {
  const { allowedDepartments, isAdmin } = usePermissions();
  const { toasts, toast, removeToast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [facialSaveError, setFacialSaveError] = useState(false);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [facialDescriptor, setFacialDescriptor] = useState<number[] | null>(null);
  const [facialPreview, setFacialPreview] = useState<string | null>(null);
  const [facialDataId, setFacialDataId] = useState<string | null>(null);
  const [hasExistingDescriptor, setHasExistingDescriptor] = useState(false);
  const [processingFace, setProcessingFace] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPIS = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 8) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 8)}.${digits.slice(8)}`;
  };

  const [formData, setFormData] = useState({
    full_name: professional.full_name,
    cpf: professional.cpf ? formatCPF(professional.cpf) : '',
    pis_number: professional.pis_number ? formatPIS(professional.pis_number) : '',
    hire_date: professional.hire_date || '',
    category_id: professional.category_id,
    department_id: professional.department_id,
    company_id: professional.company_id || '',
    registration_number: professional.registration_number || '',
    coren: professional.coren || '',
    phone: professional.phone || '',
    email: professional.email || '',
    contracted_hours_per_month: professional.contracted_hours_per_month || 180,
  });

  useEffect(() => {
    loadCategories();
    loadDepartments();
    loadCompanies();
    loadFacialData();
    initModels();
  }, []);

  const initModels = async () => {
    try {
      await loadModels();
      setModelsReady(true);
    } catch (err) {
      console.error('Error loading face recognition models:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('professional_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      if (data) setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      if (data) {
        if (isAdmin() || !allowedDepartments) {
          setDepartments(data);
        } else {
          const filtered = data.filter(dept => allowedDepartments.includes(dept.id));
          setDepartments(filtered);
        }
      }
    } catch (err) {
      console.error('Error loading departments:', err);
    }
  };

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      if (data) setCompanies(data);
    } catch (err) {
      console.error('Error loading companies:', err);
    }
  };

  const loadFacialData = async () => {
    try {
      const { data, error } = await supabase
        .from('professional_facial_data')
        .select('id, facial_descriptors')
        .eq('professional_id', professional.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setFacialDataId(data.id);
        if (data.facial_descriptors) {
          setFacialDescriptor(data.facial_descriptors);
          setHasExistingDescriptor(true);
        }
      }
    } catch (err) {
      console.error('Error loading facial data:', err);
    }
  };

  const handleFaceCapture = (imageDataUrl: string) => {
    setFacialPreview(imageDataUrl);
    setFaceError(null);
    setProcessingFace(true);

    setTimeout(async () => {
      try {
        if (!modelsReady) {
          await loadModels();
          setModelsReady(true);
        }

        const descriptor = await extractFaceDescriptor(imageDataUrl);

        if (!descriptor) {
          setFaceError('Nenhum rosto detectado na imagem. Tente novamente com melhor iluminacao.');
          setFacialDescriptor(null);
          setHasExistingDescriptor(false);
        } else {
          const descriptorArray = descriptorToArray(descriptor);
          setFacialDescriptor(descriptorArray);
          setHasExistingDescriptor(false);
          setFaceError(null);
        }
      } catch (err) {
        console.error('Error extracting face descriptor:', err);
        setFaceError('Erro ao processar reconhecimento facial. A foto foi salva, mas a biometria pode nao funcionar.');
        setFacialDescriptor(null);
      }
      setProcessingFace(false);
    }, 100);
  };

  const handleRemoveFacial = () => {
    setFacialDescriptor(null);
    setFacialPreview(null);
    setFaceError(null);
    setHasExistingDescriptor(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('professionals')
        .update({
          full_name: formData.full_name,
          cpf: formData.cpf.replace(/\D/g, ''),
          pis_number: formData.pis_number.replace(/\D/g, ''),
          hire_date: formData.hire_date || null,
          category_id: formData.category_id,
          department_id: formData.department_id,
          company_id: formData.company_id,
          registration_number: formData.registration_number || null,
          coren: formData.coren?.trim() || null,
          phone: formData.phone || null,
          email: formData.email || null,
          contracted_hours_per_month: formData.contracted_hours_per_month,
          updated_at: new Date().toISOString(),
        })
        .eq('id', professional.id);

      if (error) throw error;

      if (facialDescriptor && !hasExistingDescriptor) {
        if (facialDataId) {
          const { error: updateError } = await supabase
            .from('professional_facial_data')
            .update({
              facial_descriptors: facialDescriptor,
              facial_image_url: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', facialDataId);

          if (updateError) {
            console.error('Error updating facial data:', updateError);
            setFacialSaveError(true);
            setLoading(false);
            return;
          }
        } else {
          const { error: insertError } = await supabase
            .from('professional_facial_data')
            .insert({
              professional_id: professional.id,
              facial_descriptors: facialDescriptor,
            });

          if (insertError) {
            console.error('Error inserting facial data:', insertError);
            setFacialSaveError(true);
            setLoading(false);
            return;
          }
        }
      } else if (!facialDescriptor && facialDataId) {
        const { error: deleteError } = await supabase
          .from('professional_facial_data')
          .delete()
          .eq('id', facialDataId);

        if (deleteError) {
          console.error('Error deleting facial data:', deleteError);
          setFacialSaveError(true);
          setLoading(false);
          return;
        }
      }

      onSuccess();
    } catch (err: any) {
      toast.error('Erro ao atualizar profissional: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 lg:p-6 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Editar Profissional</h2>
          </div>
          <button
            onClick={facialSaveError ? onSuccess : onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {facialSaveError && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Profissional atualizado com sucesso!</p>
              <p>Porém, os dados biométricos não puderam ser salvos. Tente capturar a biometria novamente.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Joao Silva"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CPF *
              </label>
              <input
                type="text"
                required
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: formatCPF(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="000.000.000-00"
                maxLength={14}
              />
              <p className="text-xs text-gray-500 mt-1">
                Obrigatorio para o AFD
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PIS/PASEP <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.pis_number}
                onChange={(e) => setFormData({ ...formData, pis_number: formatPIS(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="000.00000.00"
                maxLength={13}
              />
              <p className="text-xs text-gray-500 mt-1">
                Necessario para gerar o AFD (Arquivo Fiscal Digital).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Admissao *
              </label>
              <input
                type="date"
                required
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoria Profissional *
              </label>
              <select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Selecione</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Setor *
              </label>
              <select
                required
                value={formData.department_id}
                onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Selecione</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empresa *
              </label>
              <select
                required
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Selecione</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Carga Horaria Mensal (horas) *
              </label>
              <input
                type="number"
                required
                min="1"
                max="300"
                value={formData.contracted_hours_per_month}
                onChange={(e) => setFormData({ ...formData, contracted_hours_per_month: parseInt(e.target.value) || 180 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="180"
              />
              <p className="text-xs text-gray-500 mt-1">
                Exemplo: 180h (12x36), 240h (24x48), 200h (40h/semana)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Matricula/Registro
              </label>
              <input
                type="text"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                COREN <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="text"
                value={formData.coren}
                onChange={(e) => setFormData({ ...formData, coren: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Ex: 596753"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="(11) 98765-4321"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="joao.silva@hospital.com"
            />
          </div>

          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Reconhecimento Facial (Opcional)
            </label>
            <p className="text-xs text-gray-600 mb-3">
              Cadastre a biometria facial para habilitar o registro de ponto por reconhecimento facial. Apenas os dados biometricos serao armazenados (nao a foto).
            </p>

            {!modelsReady && (
              <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando modelos de reconhecimento facial...</span>
              </div>
            )}

            {processingFace && (
              <div className="flex items-center gap-2 text-sm text-blue-600 mb-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processando reconhecimento facial...</span>
              </div>
            )}

            {faceError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700">{faceError}</span>
              </div>
            )}

            {facialDescriptor || hasExistingDescriptor ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-green-700">
                    {hasExistingDescriptor && !facialPreview
                      ? 'Biometria facial ja cadastrada'
                      : 'Biometria facial cadastrada com sucesso!'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  {facialPreview && (
                    <img
                      src={facialPreview}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-lg border-2 border-green-300"
                    />
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowFaceCapture(true)}
                      disabled={!modelsReady}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
                    >
                      {hasExistingDescriptor ? 'Atualizar Biometria' : 'Recapturar'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFacial}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowFaceCapture(true)}
                disabled={!modelsReady || processingFace}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
                Capturar Biometria Facial
              </button>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Salvando...' : 'Salvar Alteracoes'}
            </button>
          </div>
        </form>
      </div>

      <FaceCaptureModal
        isOpen={showFaceCapture}
        onClose={() => setShowFaceCapture(false)}
        onCapture={handleFaceCapture}
        title="Cadastro de Biometria Facial"
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
