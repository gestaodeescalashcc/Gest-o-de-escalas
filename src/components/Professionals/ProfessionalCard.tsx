import { Mail, Phone, CreditCard, Building2, MoreVertical, UserX, UserCheck, Edit } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import EditProfessionalModal from './EditProfessionalModal';

interface ProfessionalCardProps {
  professional: {
    id: string;
    full_name: string;
    registration_number: string | null;
    phone: string | null;
    email: string | null;
    active: boolean;
    category: {
      name: string;
      color: string;
    };
    category_id?: string;
    department: {
      name: string;
    };
    department_id?: string;
  };
  onUpdate: () => void;
}

export default function ProfessionalCard({ professional, onUpdate }: ProfessionalCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleToggleActive = async () => {
    const { error } = await supabase
      .from('professionals')
      .update({ active: !professional.active, updated_at: new Date().toISOString() })
      .eq('id', professional.id);

    if (!error) {
      onUpdate();
    }
  };

  return (
    <div className={`bg-white border rounded-lg p-5 hover:shadow-md transition relative ${
      !professional.active ? 'opacity-60' : ''
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: professional.category?.color || '#6B7280' }}
          >
            {professional.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{professional.full_name}</h3>
            <p className="text-sm text-gray-500">{professional.category?.name || 'Sem categoria'}</p>
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
                  setShowEditModal(true);
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleToggleActive();
                }}
                className={`w-full px-4 py-2 text-left flex items-center gap-2 ${
                  professional.active
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-green-600 hover:bg-green-50'
                }`}
              >
                {professional.active ? (
                  <>
                    <UserX className="w-4 h-4" />
                    Desativar
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Ativar
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {professional.registration_number && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CreditCard className="w-4 h-4" />
            <span>{professional.registration_number}</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Building2 className="w-4 h-4" />
          <span>{professional.department?.name || 'Sem setor'}</span>
        </div>

        {professional.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-4 h-4" />
            <span>{professional.phone}</span>
          </div>
        )}

        {professional.email && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="w-4 h-4" />
            <span className="truncate">{professional.email}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
            professional.active
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {professional.active ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
          {professional.active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {showEditModal && (
        <EditProfessionalModal
          professional={{
            id: professional.id,
            full_name: professional.full_name,
            category_id: professional.category_id || '',
            department_id: professional.department_id || '',
            registration_number: professional.registration_number,
            phone: professional.phone,
            email: professional.email,
          }}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
