import { useState, useEffect } from 'react';
import { Clock, Calendar, FileText, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToPDF, escapeHTML } from '../../utils/pdfExport';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface HistoryEntry {
  id: string;
  action_type: string;
  created_at: string;
  shift: {
    shift_date: string;
    shift_type: string;
    professional: {
      full_name: string;
    };
  };
}

export default function HistoryView() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toasts, toast, removeToast } = useToast();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shift_history')
        .select(`
          *,
          shift:shifts (
            shift_date,
            shift_type,
            professional:professionals (
              full_name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (data) setHistory(data as any);
    } catch (err) {
      console.error('Error loading history:', err);
      toast.error('Erro ao carregar histórico de ações.');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'Criado':
        return <FileText className="w-5 h-5 text-green-600" />;
      case 'Modificado':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'Trocado':
        return <FileText className="w-5 h-5 text-yellow-600" />;
      case 'Cancelado':
        return <FileText className="w-5 h-5 text-red-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'Criado':
        return 'bg-green-50 border-green-200';
      case 'Modificado':
        return 'bg-blue-50 border-blue-200';
      case 'Trocado':
        return 'bg-yellow-50 border-yellow-200';
      case 'Cancelado':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const handleExportPDF = () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 40px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="margin: 0; font-size: 28px; color: #1f2937;">Histórico de Alterações</h1>
          <p style="margin: 10px 0; font-size: 14px; color: #6b7280;">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
          </p>
          <p style="margin: 5px 0; font-size: 12px; color: #9ca3af;">
            Últimas ${history.length} alterações registradas
          </p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #3b82f6; color: white;">
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Ação</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Profissional</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Data do Plantão</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Tipo</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Data/Hora da Alteração</th>
            </tr>
          </thead>
          <tbody>
            ${history.map((entry, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#f9fafb' : 'white'};">
                <td style="padding: 10px; border: 1px solid #ddd; font-weight: 600;">${escapeHTML(entry.action_type)}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${escapeHTML(entry.shift?.professional?.full_name || 'N/A')}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">
                  ${entry.shift?.shift_date ? new Date(entry.shift.shift_date + 'T12:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                </td>
                <td style="padding: 10px; border: 1px solid #ddd;">${escapeHTML(entry.shift?.shift_type || 'N/A')}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">
                  ${new Date(entry.created_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 11px; color: #6b7280;">
          <p><strong>Legenda de Ações:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Criado:</strong> Novo plantão adicionado ao sistema</li>
            <li><strong>Modificado:</strong> Dados do plantão foram alterados</li>
            <li><strong>Trocado:</strong> Plantão foi trocado entre profissionais</li>
            <li><strong>Cancelado:</strong> Plantão foi cancelado</li>
          </ul>
        </div>
      </div>
    `;

    exportToPDF(container, 'Historico_Alteracoes.pdf', (msg) => toast.error(msg));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Histórico de Alterações</h2>
          <p className="text-gray-600 mt-1">Acompanhe todas as modificações nos plantões</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Download className="w-5 h-5" />
            Exportar PDF
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Carregando histórico...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum histórico disponível</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((entry) => (
              <div
                key={entry.id}
                className={`border rounded-lg p-4 ${getActionColor(entry.action_type)}`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getActionIcon(entry.action_type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">{entry.action_type}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-600">
                        {entry.shift?.professional?.full_name || 'N/A'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {entry.shift?.shift_date
                            ? new Date(entry.shift.shift_date + 'T12:00:00').toLocaleDateString('pt-BR')
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>
                          {new Date(entry.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {entry.shift?.shift_type && (
                        <div className="px-2 py-0.5 bg-white rounded text-xs font-medium">
                          {entry.shift.shift_type}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
