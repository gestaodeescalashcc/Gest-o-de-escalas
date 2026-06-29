import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, MapPin, FileText, Check, X, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface Establishment {
  id: string;
  employer_name: string;
  employer_document: string;
  employer_document_type: string;
  cei_caepf_cno: string | null;
  address_street: string;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string;
  address_state: string;
  address_zip: string;
  timezone: string;
  rep_p_registration: string | null;
  active: boolean;
  created_at: string;
}

export default function EstablishmentsView() {
  const { toasts, toast, removeToast } = useToast();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    employer_name: '',
    employer_document: '',
    employer_document_type: 'CNPJ',
    cei_caepf_cno: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    address_zip: '',
    timezone: 'America/Sao_Paulo',
    rep_p_registration: ''
  });

  useEffect(() => {
    loadEstablishments();
  }, []);

  const loadEstablishments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('establishments')
      .select('*')
      .order('employer_name');

    if (error) {
      console.error('Error loading establishments:', error);
    } else {
      setEstablishments(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      employer_name: formData.employer_name,
      employer_document: formData.employer_document,
      employer_document_type: formData.employer_document_type,
      cei_caepf_cno: formData.cei_caepf_cno || null,
      address_street: formData.address_street,
      address_number: formData.address_number || null,
      address_complement: formData.address_complement || null,
      address_neighborhood: formData.address_neighborhood || null,
      address_city: formData.address_city,
      address_state: formData.address_state,
      address_zip: formData.address_zip,
      timezone: formData.timezone,
      rep_p_registration: formData.rep_p_registration || null
    };

    if (editingId) {
      const { error } = await supabase
        .from('establishments')
        .update(payload)
        .eq('id', editingId);

      if (error) {
        console.error('Error updating establishment:', error);
        toast.error('Erro ao atualizar estabelecimento: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('establishments')
        .insert(payload);

      if (error) {
        console.error('Error creating establishment:', error);
        toast.error('Erro ao criar estabelecimento: ' + error.message);
        return;
      }
    }

    toast.success(editingId ? 'Estabelecimento atualizado com sucesso!' : 'Estabelecimento criado com sucesso!');
    closeModal();
    loadEstablishments();
  };

  const openEditModal = (establishment: Establishment) => {
    setFormData({
      employer_name: establishment.employer_name,
      employer_document: establishment.employer_document,
      employer_document_type: establishment.employer_document_type,
      cei_caepf_cno: establishment.cei_caepf_cno || '',
      address_street: establishment.address_street,
      address_number: establishment.address_number || '',
      address_complement: establishment.address_complement || '',
      address_neighborhood: establishment.address_neighborhood || '',
      address_city: establishment.address_city,
      address_state: establishment.address_state,
      address_zip: establishment.address_zip,
      timezone: establishment.timezone,
      rep_p_registration: establishment.rep_p_registration || ''
    });
    setEditingId(establishment.id);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      employer_name: '',
      employer_document: '',
      employer_document_type: 'CNPJ',
      cei_caepf_cno: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_neighborhood: '',
      address_city: '',
      address_state: '',
      address_zip: '',
      timezone: 'America/Sao_Paulo',
      rep_p_registration: ''
    });
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from('establishments')
      .update({ active: !currentActive })
      .eq('id', id);

    if (error) {
      console.error('Error toggling establishment:', error);
      toast.error('Erro ao atualizar estabelecimento: ' + error.message);
    } else {
      toast.success(currentActive ? 'Estabelecimento desativado.' : 'Estabelecimento ativado.');
      loadEstablishments();
    }
  };

  const states = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
            <Building2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Estabelecimentos</h1>
            <p className="text-gray-600">Gestao de unidades para o REP-P</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Estabelecimento
        </button>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">REP-P - Multiunidade</p>
            <p>Cada estabelecimento possui seu proprio NSR sequencial. Os dados do empregador sao utilizados nos comprovantes e arquivos de fiscalizacao (AFD/AEJ).</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando estabelecimentos...</p>
        </div>
      ) : establishments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">Nenhum estabelecimento cadastrado</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Cadastrar Primeiro Estabelecimento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {establishments.map((establishment) => (
            <div
              key={establishment.id}
              className={`bg-white rounded-xl shadow-sm border-2 p-6 ${
                establishment.active ? 'border-gray-200' : 'border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{establishment.employer_name}</h3>
                  <p className="text-sm text-gray-600">
                    {establishment.employer_document_type}: {establishment.employer_document}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  establishment.active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {establishment.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>
                    {establishment.address_street}, {establishment.address_number || 'S/N'}
                    {establishment.address_neighborhood && ` - ${establishment.address_neighborhood}`}
                    <br />
                    {establishment.address_city}/{establishment.address_state} - {establishment.address_zip}
                  </span>
                </div>

                {establishment.rep_p_registration && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span>Registro INPI: {establishment.rep_p_registration}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => openEditModal(establishment)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button
                  onClick={() => toggleActive(establishment.id, establishment.active)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-1 ${
                    establishment.active
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {establishment.active ? (
                    <>
                      <X className="w-4 h-4" />
                      Desativar
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Ativar
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Editar Estabelecimento' : 'Novo Estabelecimento'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Razao Social / Nome *
                </label>
                <input
                  type="text"
                  value={formData.employer_name}
                  onChange={(e) => setFormData({ ...formData, employer_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Documento *
                  </label>
                  <select
                    value={formData.employer_document_type}
                    onChange={(e) => setFormData({ ...formData, employer_document_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="CNPJ">CNPJ</option>
                    <option value="CPF">CPF</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.employer_document_type} *
                  </label>
                  <input
                    type="text"
                    value={formData.employer_document}
                    onChange={(e) => setFormData({ ...formData, employer_document: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={formData.employer_document_type === 'CNPJ' ? '00.000.000/0001-00' : '000.000.000-00'}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CEI/CAEPF/CNO (opcional)
                </label>
                <input
                  type="text"
                  value={formData.cei_caepf_cno}
                  onChange={(e) => setFormData({ ...formData, cei_caepf_cno: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logradouro *
                  </label>
                  <input
                    type="text"
                    value={formData.address_street}
                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numero
                  </label>
                  <input
                    type="text"
                    value={formData.address_number}
                    onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="S/N"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={formData.address_complement}
                    onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={formData.address_neighborhood}
                    onChange={(e) => setFormData({ ...formData, address_neighborhood: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    value={formData.address_city}
                    onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado *
                  </label>
                  <select
                    value={formData.address_state}
                    onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecione...</option>
                    {states.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CEP *
                  </label>
                  <input
                    type="text"
                    value={formData.address_zip}
                    onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="00000-000"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registro INPI (REP-P)
                </label>
                <input
                  type="text"
                  value={formData.rep_p_registration}
                  onChange={(e) => setFormData({ ...formData, rep_p_registration: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Numero do registro no INPI"
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-gray-600">
                    <p className="font-medium mb-1">Conformidade Art. 91</p>
                    <p>O REP-P deve possuir certificado de registro de programa de computador no INPI. Informe o numero do registro quando disponivel.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  {editingId ? 'Salvar Alteracoes' : 'Criar Estabelecimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
