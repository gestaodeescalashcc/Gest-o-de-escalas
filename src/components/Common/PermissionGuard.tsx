import { ReactNode } from 'react';
import { Shield, Lock } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

interface PermissionGuardProps {
  children: ReactNode;
  module: 'professionals' | 'schedules' | 'swaps' | 'departments' | 'professional_categories' | 'companies' | 'reports' | 'users';
  action: string;
  fallback?: ReactNode;
  hideIfNoPermission?: boolean;
}

export default function PermissionGuard({
  children,
  module,
  action,
  fallback,
  hideIfNoPermission = false
}: PermissionGuardProps) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  const hasAccess = hasPermission(module, action);

  if (!hasAccess) {
    if (hideIfNoPermission) {
      return null;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-10 h-10 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Acesso Negado</h3>
          <p className="text-gray-600 mb-4">
            Você não tem permissão para acessar esta funcionalidade.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Shield className="w-4 h-4" />
              <span>
                Permissão necessária: <strong className="text-gray-900">{module}.{action}</strong>
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Entre em contato com um administrador para solicitar acesso.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
