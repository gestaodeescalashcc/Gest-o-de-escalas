import { ReactNode } from 'react';
import { LucideIcon, Inbox, Search, AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  /** Icon component from lucide-react */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary call-to-action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Secondary link/button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'search' | 'error';
  /** Additional content (e.g., illustration) */
  children?: ReactNode;
  className?: string;
}

const VARIANT_STYLES = {
  default: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    Icon: Inbox,
  },
  search: {
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-500',
    Icon: Search,
  },
  error: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    Icon: AlertCircle,
  },
};

export default function EmptyState({
  icon: CustomIcon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  children,
  className = '',
}: EmptyStateProps) {
  const v = VARIANT_STYLES[variant];
  const Icon = CustomIcon ?? v.Icon;
  const ActionIcon = action?.icon;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}
    >
      <div
        className={`w-20 h-20 rounded-2xl ${v.iconBg} flex items-center justify-center mb-5 relative`}
      >
        <Icon className={`w-10 h-10 ${v.iconColor}`} aria-hidden="true" strokeWidth={1.5} />
        {/* Decorative dots */}
        <span
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-white border-2 border-current opacity-30"
          aria-hidden="true"
        />
        <span
          className="absolute -bottom-1 -left-2 w-2 h-2 rounded-full bg-current opacity-20"
          aria-hidden="true"
        />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 max-w-md">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-gray-600 max-w-md leading-relaxed">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="px-4 py-2.5 min-h-[44px] text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 rounded-lg"
            >
              {secondaryAction.label}
            </button>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {ActionIcon && <ActionIcon className="w-4 h-4" aria-hidden="true" />}
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
