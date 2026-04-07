import { useState, useEffect } from 'react';
import { FileText, Download, Shield, AlertCircle, CheckCircle, XCircle, Building2, Calendar, Users, Hash, RefreshCw, Clock, FileCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../Common/ToastContainer';

interface Establishment {
  id: string;
  employer_name: string;
  employer_document: string;
}

interface ExportJob {
  id: string;
  export_type: string;
  establishment_id: string;
  start_date: string;
  end_date: string;
  status: string;
  file_hash: string;
  is_fiscal_request: boolean;
  fiscal_protocol: string | null;
  requested_at: string;
  completed_at: string | null;
}

interface IntegrityResult {
  total_records: number;
  valid_records: number;
  invalid_records: number;
  chain_intact: boolean;
  first_nsr: number;
  last_nsr: number;
  issues: any[];
}

export default function FiscalExportsView() {
  const { toasts, toast, removeToast } = useToast();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isFiscalRequest, setIsFiscalRequest] = useState(false);
  const [fiscalProtocol, setFiscalProtocol] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'AFD' | 'AEJ' | null>(null);
  const [integrityResult, setIntegrityResult] = useState<IntegrityResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    loadEstablishments();
    loadExportJobs();

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().slice(0, 10));
    setEndDate(lastDay.toISOString().slice(0, 10));
  }, []);

  const loadEstablishments = async () => {
    const { data, error } = await supabase
      .from('establishments')
      .select('id, employer_name, employer_document')
      .eq('active', true)
      .order('employer_name');
    if (error) {
      console.error('Error loading establishments:', error);
      toast.error('Erro ao carregar estabelecimentos.');
      return;
    }
    if (data) {
      setEstablishments(data);
      if (data.length > 0) {
        setSelectedEstablishment(data[0].id);
      }
    }
  };

  const loadExportJobs = async () => {
    const { data, error } = await supabase
      .from('export_jobs')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('Error loading export jobs:', error);
      toast.error('Erro ao carregar histórico de exportações.');
      return;
    }
    if (data) setExportJobs(data);
  };

  const exportAFD = async () => {
    if (!selectedEstablishment || !startDate || !endDate) {
      toast.error('Selecione o estabelecimento e o periodo');
      return;
    }

    setExporting('AFD');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessao expirada');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-afd`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            establishment_id: selectedEstablishment,
            start_date: startDate,
            end_date: endDate,
            is_fiscal_request: isFiscalRequest,
            fiscal_protocol: fiscalProtocol || null
          })
        }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error('Erro ao gerar AFD: ' + result.error);
        return;
      }

      const blob = new Blob([result.data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      loadExportJobs();
    } catch (error) {
      console.error('Error exporting AFD:', error);
      toast.error('Erro de conexao ao exportar AFD');
    } finally {
      setExporting(null);
    }
  };

  const exportAEJ = async () => {
    if (!selectedEstablishment || !startDate || !endDate) {
      toast.error('Selecione o estabelecimento e o periodo');
      return;
    }

    setExporting('AEJ');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessao expirada');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-aej`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            establishment_id: selectedEstablishment,
            start_date: startDate,
            end_date: endDate
          })
        }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error('Erro ao gerar AEJ: ' + result.error);
        return;
      }

      const blob = new Blob([result.data.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      loadExportJobs();
    } catch (error) {
      console.error('Error exporting AEJ:', error);
      toast.error('Erro de conexao ao exportar AEJ');
    } finally {
      setExporting(null);
    }
  };

  const verifyIntegrity = async () => {
    if (!selectedEstablishment) {
      toast.error('Selecione um estabelecimento');
      return;
    }

    setVerifying(true);
    setIntegrityResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessao expirada');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-chain-integrity`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            establishment_id: selectedEstablishment,
            start_date: startDate,
            end_date: endDate
          })
        }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error('Erro ao verificar integridade: ' + result.error);
        return;
      }

      setIntegrityResult(result.data);
    } catch (error) {
      console.error('Error verifying integrity:', error);
      toast.error('Erro de conexao ao verificar integridade');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center">
            <FileCheck className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Exportacoes Fiscais</h1>
            <p className="text-gray-600">AFD e AEJ conforme Portaria MTP 671/2021</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Parametros de Exportacao</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estabelecimento
                </label>
                <select
                  value={selectedEstablishment}
                  onChange={(e) => setSelectedEstablishment(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {establishments.map(e => (
                    <option key={e.id} value={e.id}>{e.employer_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Inicial
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Final
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFiscalRequest}
                  onChange={(e) => setIsFiscalRequest(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="font-medium text-amber-900">Solicitacao de Fiscalizacao</span>
                  <p className="text-sm text-amber-700">Marque se esta exportacao e para atender a Auditoria Fiscal do Trabalho</p>
                </div>
              </label>

              {isFiscalRequest && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-amber-800 mb-2">
                    Protocolo de Fiscalizacao
                  </label>
                  <input
                    type="text"
                    value={fiscalProtocol}
                    onChange={(e) => setFiscalProtocol(e.target.value)}
                    className="w-full px-4 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                    placeholder="Numero do protocolo ou auto de infracao"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={exportAFD}
                disabled={exporting !== null || !selectedEstablishment}
                className="px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting === 'AFD' ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Exportar AFD
                  </>
                )}
              </button>

              <button
                onClick={exportAEJ}
                disabled={exporting !== null || !selectedEstablishment}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting === 'AEJ' ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Exportar AEJ
                  </>
                )}
              </button>

              <button
                onClick={verifyIntegrity}
                disabled={verifying || !selectedEstablishment}
                className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Verificar Integridade
                  </>
                )}
              </button>
            </div>
          </div>

          {integrityResult && (
            <div className={`rounded-xl shadow-sm border-2 p-6 ${
              integrityResult.chain_intact
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {integrityResult.chain_intact ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-600" />
                )}
                <div>
                  <h3 className={`text-lg font-bold ${
                    integrityResult.chain_intact ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {integrityResult.chain_intact
                      ? 'Cadeia de Integridade Valida'
                      : 'Problemas Detectados na Cadeia'}
                  </h3>
                  <p className={`text-sm ${
                    integrityResult.chain_intact ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Verificacao de hash SHA-256 encadeado
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">Total de Registros</p>
                  <p className="text-2xl font-bold text-gray-900">{integrityResult.total_records}</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">Registros Validos</p>
                  <p className="text-2xl font-bold text-green-600">{integrityResult.valid_records}</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">Registros Invalidos</p>
                  <p className="text-2xl font-bold text-red-600">{integrityResult.invalid_records}</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">Faixa NSR</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {integrityResult.first_nsr} - {integrityResult.last_nsr}
                  </p>
                </div>
              </div>

              {integrityResult.issues.length > 0 && (
                <div className="mt-4 p-4 bg-white rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Problemas Encontrados:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {integrityResult.issues.map((issue, index) => (
                      <div key={index} className="text-sm text-red-800 p-2 bg-red-50 rounded">
                        <span className="font-medium">[NSR {issue.nsr}]</span> {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-emerald-900">
                <p className="font-semibold mb-2">Conformidade com a Legislacao</p>
                <ul className="space-y-1">
                  <li><strong>AFD (Art. 81):</strong> Arquivo Fonte de Dados com todas as marcacoes brutas</li>
                  <li><strong>AEJ (Art. 83):</strong> Arquivo Eletronico de Jornada com tratamento e totalizacao</li>
                  <li><strong>Art. 85:</strong> Prazo minimo de 2 dias para entrega ao Auditor-Fiscal</li>
                  <li><strong>Art. 88:</strong> Assinatura CAdES (p7s) para AFD e AEJ</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Historico de Exportacoes</h2>

            {exportJobs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhuma exportacao realizada</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {exportJobs.map((job) => (
                  <div
                    key={job.id}
                    className={`border rounded-lg p-3 ${
                      job.is_fiscal_request
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        job.export_type === 'AFD'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {job.export_type}
                      </span>
                      {job.is_fiscal_request && (
                        <span className="px-2 py-1 bg-amber-200 text-amber-800 rounded text-xs font-medium">
                          Fiscal
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-700 mb-1">
                      {new Date(job.start_date).toLocaleDateString('pt-BR')} - {new Date(job.end_date).toLocaleDateString('pt-BR')}
                    </p>

                    <p className="text-xs text-gray-500">
                      {new Date(job.requested_at).toLocaleString('pt-BR')}
                    </p>

                    {job.file_hash && (
                      <p className="text-xs text-gray-400 font-mono mt-1 truncate">
                        Hash: {job.file_hash.substring(0, 24)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
