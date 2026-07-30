import { useState, useEffect } from 'react';
import { X, Camera, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FaceCaptureModal from '../FacialRecognition/FaceCaptureModal';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';
import MultiSelectChips from '../Common/MultiSelectChips';

interface CreateProfessionalModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateProfessionalModal({ onClose, onSuccess }: CreateProfessionalModalProps) {
  const { toasts, toast, removeToast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [facialSaveError, setFacialSaveError] = useState(false);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [facialDescriptor, setFacialDescriptor] = useState<number[] | null>(null);
  const [facialPreview, setFacialPreview] = useState<string | null>(null);
  const [processingFace, setProcessingFace] = useState(false);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [modelsReady, setModelsReady] = useState(false);

  // Multi-categoria e multi-setor (links N:N) + IDs primários (legado)
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    cpf: '',
    pis_number: '',
    hire_date: '',
    category_id: '',
    department_id: '',
    company_id: '',
    registration_number: '',
    coren: '',
    on_leave: false,
    leave_reason: '',
    leave_started_at: '',
    phone: '',
    email: '',
    contracted_hours_per_month: 180,
    cbo: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    bank_name: '',
    bank_agency: '',
    bank_account: '',
    admission_process_number: '',
    labor_restriction: '',
  });

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

  useEffect(() => {
    loadCategories();
    loadDepartments();
    loadCompanies();
    initModels();
  }, []);

  const initModels = async () => {
    try {
      // Import dinâmico: face-api.js (~640kB) só entra no bundle quando este
      // modal é de fato aberto, não no carregamento inicial do app inteiro.
      const { loadModels } = await import('../../services/faceRecognition');
      await loadModels();
      setModelsReady(true);
    } catch (err) {
      console.error('Error loading face recognition models:', err);
    }
  };

  const loadCategories = async () => {
    const { data } = await supabase
      .from('professional_categories')
      .select('*')
      .order('name');
    if (data) setCategories(data);
  };

  const loadDepartments = async () => {
    const { data } = await supabase
      .from('departments')
      .select('*')
      .eq('active', true)
      .order('name');
    if (data) setDepartments(data);
  };

  const loadCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('active', true)
      .order('name');
    if (data) setCompanies(data);
  };

  const handleFaceCapture = (imageDataUrl: string) => {
    setFacialPreview(imageDataUrl);
    setFaceError(null);
    setProcessingFace(true);

    setTimeout(async () => {
      try {
        const { loadModels, extractFaceDescriptor, descriptorToArray } = await import('../../services/faceRecognition');
        if (!modelsReady) {
          await loadModels();
          setModelsReady(true);
        }

        const descriptor = await extractFaceDescriptor(imageDataUrl);

        if (!descriptor) {
          setFaceError('Nenhum rosto detectado na imagem. Tente novamente com melhor iluminacao.');
          setFacialDescriptor(null);
        } else {
          const descriptorArray = descriptorToArray(descriptor);
          setFacialDescriptor(descriptorArray);
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!primaryCategoryId || categoryIds.length === 0) {
      toast.error('Selecione ao menos uma categoria.');
      return;
    }
    if (!primaryDepartmentId || departmentIds.length === 0) {
      toast.error('Selecione ao menos um setor.');
      return;
    }

    setLoading(true);

    try {
      const { data: professionalData, error } = await supabase.from('professionals').insert({
        full_name: formData.full_name,
        cpf: formData.cpf.replace(/\D/g, ''),
        pis_number: formData.pis_number.replace(/\D/g, ''),
        hire_date: formData.hire_date || null,
        category_id: primaryCategoryId,
        department_id: primaryDepartmentId,
        company_id: formData.company_id,
        registration_number: formData.registration_number || null,
        coren: formData.coren?.trim() || null,
        on_leave: formData.on_leave,
        leave_reason: formData.on_leave ? (formData.leave_reason?.trim() || null) : null,
        leave_started_at: formData.on_leave ? (formData.leave_started_at || null) : null,
        phone: formData.phone || null,
        email: formData.email || null,
        contracted_hours_per_month: formData.contracted_hours_per_month,
        cbo: formData.cbo?.trim() || null,
        emergency_contact_name: formData.emergency_contact_name?.trim() || null,
        emergency_contact_phone: formData.emergency_contact_phone?.trim() || null,
        emergency_contact_relationship: formData.emergency_contact_relationship?.trim() || null,
        bank_name: formData.bank_name?.trim() || null,
        bank_agency: formData.bank_agency?.trim() || null,
        bank_account: formData.bank_account?.trim() || null,
        admission_process_number: formData.admission_process_number?.trim() || null,
        labor_restriction: formData.labor_restriction?.trim() || null,
        active: true,
      } as any).select().maybeSingle();

      if (error) throw error;
      if (!professionalData) throw new Error('Falha ao criar profissional');

      // Grava vínculos N:N de categorias e setores
      const catLinks = categoryIds.map(id => ({
        professional_id: professionalData.id,
        category_id: id,
        is_primary: id === primaryCategoryId,
      }));
      const deptLinks = departmentIds.map(id => ({
        professional_id: professionalData.id,
        department_id: id,
        is_primary: id === primaryDepartmentId,
      }));
      if (catLinks.length > 0) {
        await supabase.from('professional_category_links').insert(catLinks as any);
      }
      if (deptLinks.length > 0) {
        await supabase.from('professional_department_links').insert(deptLinks as any);
      }

      if (professionalData && facialDescriptor) {
        const { error: facialError } = await supabase.from('professional_facial_data').insert({
          professional_id: professionalData.id,
          facial_descriptors: facialDescriptor,
        });
        if (facialError) {
          console.error('Error saving facial data:', facialError);
          setFacialSaveError(true);
          setLoading(false);
          return;
        }
      }

      onSuccess();
    } catch (err) {
      console.error('Error creating professional:', err);
      toast.error('Erro ao criar profissional. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 p-6 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">Novo Profissional</h2>
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
              <p className="font-semibold">Profissional criado com sucesso!</p>
              <p>Porém, os dados biométricos não puderam ser salvos. Edite o profissional para adicionar a biometria facial.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="000.00000.00"
                maxLength={13}
              />
              <p className="text-xs text-gray-500 mt-1">
                Necessario para gerar o AFD (Arquivo Fiscal Digital).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data de Admissao <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                type="date"
                value={formData.hire_date}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <MultiSelectChips
                label="Categoria(s) Profissional(is) *"
                options={categories}
                selectedIds={categoryIds}
                primaryId={primaryCategoryId}
                onChange={(ids, primary) => {
                  setCategoryIds(ids);
                  setPrimaryCategoryId(primary);
                }}
                placeholder="Adicionar categoria"
                emptyText="Nenhuma categoria selecionada"
              />
            </div>

            <div>
              <MultiSelectChips
                label="Setor(es) *"
                options={departments}
                selectedIds={departmentIds}
                primaryId={primaryDepartmentId}
                onChange={(ids, primary) => {
                  setDepartmentIds(ids);
                  setPrimaryDepartmentId(primary);
                }}
                placeholder="Adicionar setor"
                emptyText="Nenhum setor selecionado"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Empresa *
              </label>
              <select
                required
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="12345"
              />
            </div>

            {(() => {
              const cat = categories.find((c: any) => c.id === formData.category_id);
              const isNursing = !!cat && /enferm/i.test(cat.name ?? '');
              return isNursing ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    COREN <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.coren}
                    onChange={(e) => setFormData({ ...formData, coren: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ex: 596753"
                  />
                </div>
              ) : null;
            })()}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            {facialDescriptor ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-green-700">Biometria facial cadastrada com sucesso!</span>
                </div>
                {facialPreview && (
                  <div className="flex items-center gap-4">
                    <img
                      src={facialPreview}
                      alt="Preview"
                      className="w-24 h-24 object-cover rounded-lg border-2 border-green-300"
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setShowFaceCapture(true)}
                        disabled={!modelsReady}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50"
                      >
                        Recapturar
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
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowFaceCapture(true)}
                disabled={!modelsReady || processingFace}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
                Capturar Biometria Facial
              </button>
            )}
          </div>

          {/* Dados de RH */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Dados de RH</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CBO</label>
                <input
                  type="text"
                  value={formData.cbo}
                  onChange={(e) => setFormData({ ...formData, cbo: e.target.value })}
                  placeholder="Ex: 2235-05"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Restrição laboral</label>
                <input
                  type="text"
                  value={formData.labor_restriction}
                  onChange={(e) => setFormData({ ...formData, labor_restriction: e.target.value })}
                  placeholder="Ex: Não pode plantão noturno"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nº processo (admissão)</label>
                <input
                  type="text"
                  value={formData.admission_process_number}
                  onChange={(e) => setFormData({ ...formData, admission_process_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Contato de emergência */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Contato de emergência</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="tel"
                  value={formData.emergency_contact_phone}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grau de parentesco</label>
                <input
                  type="text"
                  value={formData.emergency_contact_relationship}
                  onChange={(e) => setFormData({ ...formData, emergency_contact_relationship: e.target.value })}
                  placeholder="Ex: Cônjuge, Mãe, Irmão..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Dados bancários */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Dados bancários</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instituição</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
                <input
                  type="text"
                  value={formData.bank_agency}
                  onChange={(e) => setFormData({ ...formData, bank_agency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Conta</label>
                <input
                  type="text"
                  value={formData.bank_account}
                  onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Afastamento */}
          <div className="border-t border-gray-200 pt-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.on_leave}
                onChange={(e) => setFormData({ ...formData, on_leave: e.target.checked })}
                className="w-4 h-4 mt-0.5 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
              />
              <div className="flex-1">
                <span className="font-medium text-gray-900">Profissional afastado</span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Quando marcado, ele não aparece na grade da escala — fica listado no rodapé.
                </p>
              </div>
            </label>
            {formData.on_leave && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pl-7">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo do afastamento</label>
                  <input
                    type="text"
                    value={formData.leave_reason}
                    onChange={(e) => setFormData({ ...formData, leave_reason: e.target.value })}
                    placeholder="Ex: Auxílio doença, Licença maternidade..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Início do afastamento <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="date"
                    value={formData.leave_started_at}
                    onChange={(e) => setFormData({ ...formData, leave_started_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar Profissional'}
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
