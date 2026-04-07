import { useState, useEffect } from 'react';
import { BarChart3, Users, Calendar, ArrowLeftRight, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportToPDF } from '../../utils/pdfExport';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

export default function ReportsView() {
  const { toasts, toast, removeToast } = useToast();
  const [stats, setStats] = useState({
    totalProfessionals: 0,
    activeProfessionals: 0,
    totalShifts: 0,
    pendingSwaps: 0,
    upcomingShifts: 0,
    completedShifts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [
        { count: totalProf },
        { count: activeProf },
        { count: totalShifts },
        { count: pendingSwaps },
        { count: upcomingShifts },
        { count: completedShifts },
      ] = await Promise.all([
        supabase.from('professionals').select('*', { count: 'exact', head: true }),
        supabase.from('professionals').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('shifts').select('*', { count: 'exact', head: true }),
        supabase.from('shift_swaps').select('*', { count: 'exact', head: true }).eq('status', 'Pendente'),
        supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('status', 'Agendado'),
        supabase.from('shifts').select('*', { count: 'exact', head: true }).eq('status', 'Concluído'),
      ]);

      setStats({
        totalProfessionals: totalProf || 0,
        activeProfessionals: activeProf || 0,
        totalShifts: totalShifts || 0,
        pendingSwaps: pendingSwaps || 0,
        upcomingShifts: upcomingShifts || 0,
        completedShifts: completedShifts || 0,
      });
    } catch (err) {
      console.error('Error loading stats:', err);
      toast.error('Erro ao carregar estatísticas do painel.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div style="padding: 40px; font-family: Arial, sans-serif;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="margin: 0; font-size: 28px; color: #1f2937;">Relatório de Estatísticas</h1>
          <p style="margin: 10px 0; font-size: 14px; color: #6b7280;">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>

        <div style="margin-bottom: 30px;">
          <h2 style="font-size: 20px; color: #1f2937; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            Estatísticas Gerais
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Total de Profissionais</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${stats.totalProfessionals}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Profissionais Ativos</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${stats.activeProfessionals}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Total de Plantões</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${stats.totalShifts}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Plantões Agendados</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${stats.upcomingShifts}</td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Plantões Concluídos</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${stats.completedShifts}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Trocas Pendentes</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">${stats.pendingSwaps}</td>
            </tr>
          </table>
        </div>

        <div>
          <h2 style="font-size: 20px; color: #1f2937; margin-bottom: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">
            Indicadores de Performance
          </h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Taxa de Ocupação</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">
                ${stats.totalProfessionals > 0 ? Math.round((stats.activeProfessionals / stats.totalProfessionals) * 100) : 0}%
              </td>
            </tr>
            <tr>
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Plantões por Profissional (Média)</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">
                ${stats.activeProfessionals > 0 ? Math.round(stats.totalShifts / stats.activeProfessionals) : 0}
              </td>
            </tr>
            <tr style="background-color: #f3f4f6;">
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">Taxa de Conclusão</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; text-align: right;">
                ${stats.totalShifts > 0 ? Math.round((stats.completedShifts / stats.totalShifts) * 100) : 0}%
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;

    exportToPDF(container, 'Relatorio_Estatisticas.pdf', (msg) => toast.error(msg));
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Relatórios e Estatísticas</h2>
          <p className="text-gray-600 mt-1">Visão geral do sistema</p>
        </div>
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Download className="w-5 h-5" />
          Exportar PDF
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Carregando estatísticas...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              title="Total de Profissionais"
              value={stats.totalProfessionals}
              icon={Users}
              color="bg-blue-600"
            />
            <StatCard
              title="Profissionais Ativos"
              value={stats.activeProfessionals}
              icon={Users}
              color="bg-green-600"
            />
            <StatCard
              title="Total de Plantões"
              value={stats.totalShifts}
              icon={Calendar}
              color="bg-purple-600"
            />
            <StatCard
              title="Plantões Agendados"
              value={stats.upcomingShifts}
              icon={Calendar}
              color="bg-yellow-600"
            />
            <StatCard
              title="Plantões Concluídos"
              value={stats.completedShifts}
              icon={Calendar}
              color="bg-gray-600"
            />
            <StatCard
              title="Trocas Pendentes"
              value={stats.pendingSwaps}
              icon={ArrowLeftRight}
              color="bg-orange-600"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Resumo</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-700">Taxa de Ocupação</span>
                <span className="font-semibold text-gray-900">
                  {stats.totalProfessionals > 0
                    ? Math.round((stats.activeProfessionals / stats.totalProfessionals) * 100)
                    : 0}%
                </span>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-gray-700">Plantões por Profissional (Média)</span>
                <span className="font-semibold text-gray-900">
                  {stats.activeProfessionals > 0
                    ? Math.round(stats.totalShifts / stats.activeProfessionals)
                    : 0}
                </span>
              </div>

              <div className="flex items-center justify-between py-3">
                <span className="text-gray-700">Taxa de Conclusão</span>
                <span className="font-semibold text-gray-900">
                  {stats.totalShifts > 0
                    ? Math.round((stats.completedShifts / stats.totalShifts) * 100)
                    : 0}%
                </span>
              </div>
            </div>
          </div>
        </>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
