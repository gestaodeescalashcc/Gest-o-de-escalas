import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Toast } from '../../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export default function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(toast => {
        const styles = {
          success: {
            container: 'bg-green-50 border-green-200 text-green-800',
            icon: <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />,
          },
          error: {
            container: 'bg-red-50 border-red-200 text-red-800',
            icon: <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
          },
          warning: {
            container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
            icon: <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />,
          },
          info: {
            container: 'bg-blue-50 border-blue-200 text-blue-800',
            icon: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
          },
        }[toast.type];

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 border rounded-lg shadow-md ${styles.container}`}
          >
            {styles.icon}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
              onClick={() => onRemove(toast.id)}
              className="p-0.5 hover:opacity-70 transition-opacity flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
