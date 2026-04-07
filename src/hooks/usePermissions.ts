import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Permissions {
  professionals: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  schedules: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  swaps: {
    create: boolean;
    read: boolean;
    approve: boolean;
    delete: boolean;
  };
  departments: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  professional_categories: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  companies: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  reports: {
    read: boolean;
    export: boolean;
  };
  users: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
}

interface UserData {
  role: {
    name: string;
    permissions: Permissions;
  };
  allowed_departments: string[] | null;
}

const defaultPermissions: Permissions = {
  professionals: { create: false, read: false, update: false, delete: false },
  schedules: { create: false, read: false, update: false, delete: false },
  swaps: { create: false, read: false, approve: false, delete: false },
  departments: { create: false, read: false, update: false, delete: false },
  professional_categories: { create: false, read: false, update: false, delete: false },
  companies: { create: false, read: false, update: false, delete: false },
  reports: { read: false, export: false },
  users: { create: false, read: false, update: false, delete: false },
};

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);
  const [allowedDepartments, setAllowedDepartments] = useState<string[] | null>(null);
  const [roleName, setRoleName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('system_users')
        .select('role_id, allowed_departments')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading user data:', error);
        throw error;
      }

      if (!data) {
        console.warn('User not found in system_users table:', user.id);
        setPermissions(defaultPermissions);
        setRoleName('');
        setAllowedDepartments(null);
        return;
      }

      if (!data.role_id) {
        console.warn('User has no role assigned:', user.id);
        setPermissions(defaultPermissions);
        setRoleName('');
        setAllowedDepartments(data.allowed_departments || null);
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('name, permissions')
        .eq('id', data.role_id)
        .maybeSingle();

      if (roleError) {
        console.error('Error loading role data:', roleError);
        throw roleError;
      }

      if (roleData) {
        setPermissions(roleData.permissions || defaultPermissions);
        setRoleName(roleData.name || '');
        setAllowedDepartments(data.allowed_departments || null);
      } else {
        console.warn('Role not found for role_id:', data.role_id);
        setPermissions(defaultPermissions);
        setRoleName('');
        setAllowedDepartments(data.allowed_departments || null);
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions(defaultPermissions);
      setRoleName('');
      setAllowedDepartments(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadPermissions();
    } else {
      setPermissions(defaultPermissions);
      setAllowedDepartments(null);
      setRoleName('');
      setLoading(false);
    }
  }, [user, loadPermissions]);

  const hasPermission = (module: keyof Permissions, action: string): boolean => {
    if (!permissions[module]) return false;
    return (permissions[module] as Record<string, boolean>)[action] === true;
  };

  const canAccessDepartment = (departmentId: string): boolean => {
    if (!allowedDepartments) return true;
    return allowedDepartments.includes(departmentId);
  };

  const isAdmin = (): boolean => {
    return roleName === 'Administrador';
  };

  const canCreate = (module: keyof Permissions): boolean => {
    return hasPermission(module, 'create');
  };

  const canRead = (module: keyof Permissions): boolean => {
    return hasPermission(module, 'read');
  };

  const canUpdate = (module: keyof Permissions): boolean => {
    return hasPermission(module, 'update');
  };

  const canDelete = (module: keyof Permissions): boolean => {
    return hasPermission(module, 'delete');
  };

  const canApprove = (module: 'swaps'): boolean => {
    return hasPermission(module, 'approve');
  };

  const canExport = (module: 'reports'): boolean => {
    return hasPermission(module, 'export');
  };

  return {
    permissions,
    allowedDepartments,
    roleName,
    loading,
    hasPermission,
    canAccessDepartment,
    isAdmin,
    canCreate,
    canRead,
    canUpdate,
    canDelete,
    canApprove,
    canExport,
  };
}
