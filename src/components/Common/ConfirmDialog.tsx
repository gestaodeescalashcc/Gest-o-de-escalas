import { useRef, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const VARIANTS = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    Icon: AlertCircle,
    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white shadow-sm',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    Icon: AlertTriangle,
    button: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500 text-white shadow-sm',
  },
  default: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    Icon: Info,
    button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white shadow-sm',
  },
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const v = VARIANTS[variant];
  const Icon = v.Icon;

  // Enter triggers confirm
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT') return;
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, loading, onConfirm]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      size="md"
      bare
      closeOnEscape={!loading}
      closeOnOverlayClick={!loading}
      initialFocusRef={confirmRef}
    >
      <div className="p-6">
        <div className="flex gap-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full ${v.iconBg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${v.iconColor}`} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{message}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2.5 min-h-[44px] border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
        >
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2.5 min-h-[44px] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 inline-flex items-center justify-center gap-2 ${v.button}`}
        >
          {loading && (
            <span
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              aria-hidden="true"
            />
          )}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
