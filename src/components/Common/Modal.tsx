import { useEffect, useRef, ReactNode } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
  footer?: ReactNode;
  children: ReactNode;
  /** Use this for full custom layout (no header, padding, footer wrapper) */
  bare?: boolean;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  initialFocusRef,
  footer,
  children,
  bare = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  // Manage focus
  useEffect(() => {
    if (!isOpen) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    const focusInitial = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusables && focusables.length > 0) {
        const firstNonClose = Array.from(focusables).find(
          el => !el.hasAttribute('data-modal-close')
        );
        (firstNonClose ?? focusables[0]).focus();
      } else {
        dialogRef.current?.focus();
      }
    };
    const t = setTimeout(focusInitial, 50);

    return () => {
      clearTimeout(t);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [isOpen, initialFocusRef]);

  // Keyboard handling: Escape + focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (!focusables || focusables.length === 0) {
          e.preventDefault();
          return;
        }
        const list = Array.from(focusables).filter(el => !el.hasAttribute('disabled'));
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const titleId = `modal-title-${title?.replace(/\s+/g, '-').toLowerCase() ?? 'untitled'}`;
  const descId = `modal-desc-${title?.replace(/\s+/g, '-').toLowerCase() ?? 'untitled'}`;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!closeOnOverlayClick) return;
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleOverlayClick}
      className="fixed inset-0 bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 sm:p-6 animate-modal-fade-in"
      style={{ animation: 'modal-fade-in 0.18s ease-out' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-2xl w-full ${SIZE_CLASSES[size]} ${
          size === 'full' ? 'h-full overflow-hidden' : 'max-h-[90vh] overflow-hidden'
        } flex flex-col focus:outline-none animate-modal-slide-in`}
        style={{ animation: 'modal-slide-in 0.22s ease-out' }}
      >
        {!bare && title && (
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200">
            <div className="flex-1 min-w-0">
              <h2 id={titleId} className="text-lg font-semibold text-gray-900 truncate">
                {title}
              </h2>
              {description && (
                <p id={descId} className="text-sm text-gray-600 mt-1">
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                data-modal-close
                onClick={onClose}
                aria-label="Fechar"
                className="flex-shrink-0 w-10 h-10 -mr-2 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        <div className={bare ? 'flex-1 overflow-y-auto' : 'flex-1 overflow-y-auto px-6 py-5'}>
          {children}
        </div>

        {footer && !bare && (
          <div className="flex flex-wrap gap-3 justify-end px-6 py-4 border-t border-gray-200 bg-gray-50/50">
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modal-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modal-slide-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
