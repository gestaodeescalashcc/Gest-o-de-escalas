import { Clock, MapPin, MoreVertical, Trash2, Edit } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import ConfirmDialog from '../Common/ConfirmDialog';
import ToastContainer from '../Common/ToastContainer';
import { useToast } from '../../hooks/useToast';

interface ShiftCardProps {
  shift: {
    id: string;
    shift_date: string;
    start_time: string;
    end_time: string;
    shift_type: string;
    status: string;
    notes: string;
    professional: {
      full_name: string;
      category: {
        name: string;
        color: string;
      };
    };
    department: {
      name: string;
    };
  };
  onUpdate: () => void;
}

export default function ShiftCard({ shift, onUpdate }: ShiftCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { toasts, toast, removeToast } = useToast();

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('shifts').delete().eq('id', shift.id);

      if (error) {
        console.error('Error deleting shift:', error);
        toast.error('Erro ao excluir plantão: ' + error.message);
        return;
      }

      onUpdate();
    } catch (err: any) {
      console.error('Unexpected error deleting shift:', err);
      toast.error('Erro inesperado ao excluir plantão');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Agendado':
        return 'bg-blue-100 text-blue-700';
      case 'Em andamento':
        return 'bg-green-100 text-green-700';
      case 'Concluído':
        return 'bg-gray-100 text-gray-700';
      case 'Cancelado':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition relative">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
            style={{ backgroundColor: shift.professional?.category?.color || '#6B7280' }}
          >
            {shift.professional?.full_name ? shift.professional.full_name.split(' ').map(n => n[0]).slice(0, 2).join('') : 'NA'}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{shift.professional?.full_name || 'N/A'}</h3>
            <p className="text-xs text-gray-500">{shift.professional?.category?.name || 'Sem categoria'}</p>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 hover:bg-gray-100 rounded transition"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              <button
                onClick={() => {
                  setShowMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setConfirmDelete(true);
                }}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>
            {new Date(shift.shift_date + 'T12:00:00').toLocaleDateString('pt-BR')} • {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4" />
          <span>{shift.department?.name || 'Sem setor'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
          {shift.shift_type}
        </span>
        <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(shift.status)}`}>
          {shift.status}
        </span>
      </div>

      {shift.notes && (
        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
          {shift.notes}
        </p>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Excluir Plantão"
        message="Deseja realmente excluir este plantão?"
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
        onCancel={() => setConfirmDelete(false)}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
