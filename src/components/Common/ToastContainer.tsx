import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Toast } from '../../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

const STYLES: Record<
  Toast['type'],
  {
    container: string;
    iconWrapper: string;
    icon: JSX.Element;
    progressBar: string;
    title: string;
    role: 'status' | 'alert';
    ariaLive: 'polite' | 'assertive';
  }
> = {
  success: {
    container: 'bg-white border-emerald-200 ring-1 ring-emerald-100',
    iconWrapper: 'bg-emerald-100',
    icon: <CheckCircle className="w-5 h-5 text-emerald-600" aria-hidden="true" />,
    progressBar: 'bg-emerald-500',
    title: 'Sucesso',
    role: 'status',
    ariaLive: 'polite',
  },
  error: {
    container: 'bg-white border-red-200 ring-1 ring-red-100',
    iconWrapper: 'bg-red-100',
    icon: <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />,
    progressBar: 'bg-red-500',
    title: 'Erro',
    role: 'alert',
    ariaLive: 'assertive',
  },
  warning: {
    container: 'bg-white border-amber-200 ring-1 ring-amber-100',
    iconWrapper: 'bg-amber-100',
    icon: <AlertTriangle className="w-5 h-5 text-amber-600" aria-hidden="true" />,
    progressBar: 'bg-amber-500',
    title: 'Atenção',
    role: 'alert',
    ariaLive: 'assertive',
  },
  info: {
    container: 'bg-white border-sky-200 ring-1 ring-sky-100',
    iconWrapper: 'bg-sky-100',
    icon: <Info className="w-5 h-5 text-sky-600" aria-hidden="true" />,
    progressBar: 'bg-sky-500',
    title: 'Informação',
    role: 'status',
    ariaLive: 'polite',
  },
};

function ToastItem({
  toast,
  onRemove,
  onPause,
  onResume,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}) {
  const style = STYLES[toast.type];
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 180);
  };

  return (
    <div
      role={style.role}
      aria-live={style.ariaLive}
      onMouseEnter={() => onPause?.(toast.id)}
      onMouseLeave={() => onResume?.(toast.id)}
      onFocus={() => onPause?.(toast.id)}
      onBlur={() => onResume?.(toast.id)}
      className={`
        relative overflow-hidden flex items-start gap-3 p-4 pr-3 border rounded-xl shadow-lg
        transition-all duration-200 ease-out
        ${style.container}
        ${isExiting ? 'opacity-0 translate-x-2 scale-95' : 'opacity-100 translate-x-0 scale-100 animate-toast-in'}
      `}
    >
      <div className={`flex-shrink-0 w-9 h-9 rounded-full ${style.iconWrapper} flex items-center justify-center`}>
        {style.icon}
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <p className="text-sm font-semibold text-gray-900">{toast.title ?? style.title}</p>
        <p className="text-sm text-gray-700 mt-0.5 break-words">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Fechar notificação"
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
      >
        <X className="w-4 h-4" />
      </button>
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${style.progressBar} animate-toast-progress origin-left`}
        style={{ animationDuration: `${toast.duration}ms` }}
        aria-hidden="true"
      />
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove, onPause, onResume }: ToastContainerProps) {
  // Inject keyframes once
  useEffect(() => {
    const id = 'toast-animations';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes toast-in {
        from { opacity: 0; transform: translateX(20px) scale(0.96); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes toast-progress {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }
      .animate-toast-in { animation: toast-in 0.22s ease-out; }
      .animate-toast-progress {
        animation-name: toast-progress;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notificações"
      className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] flex flex-col gap-3 max-w-sm w-[calc(100%-2rem)] sm:w-full pointer-events-none"
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem
            toast={toast}
            onRemove={onRemove}
            onPause={onPause}
            onResume={onResume}
          />
        </div>
      ))}
    </div>
  );
}
