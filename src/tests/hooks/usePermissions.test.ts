import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockSupabaseFrom = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

const buildQuery = (result: unknown) => {
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return q;
};

const adminPermissions = {
  professionals: { create: true, read: true, update: true, delete: true },
  schedules: { create: true, read: true, update: true, delete: true },
  swaps: { create: true, read: true, approve: true, delete: true },
  departments: { create: true, read: true, update: true, delete: true },
  professional_categories: { create: true, read: true, update: true, delete: true },
  companies: { create: true, read: true, update: true, delete: true },
  reports: { read: true, export: true },
  users: { create: true, read: true, update: true, delete: true },
};

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default (all false) permissions when no user is logged in', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.permissions.professionals.read).toBe(false);
    expect(result.current.permissions.schedules.create).toBe(false);
    expect(result.current.roleName).toBe('');
  });

  it('loads permissions from Supabase when a user is present', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123' } as any,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    mockSupabaseFrom
      .mockReturnValueOnce(
        buildQuery({ data: { role_id: 'role-1', allowed_departments: null }, error: null })
      )
      .mockReturnValueOnce(
        buildQuery({ data: { name: 'Administrador', permissions: adminPermissions }, error: null })
      );

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.roleName).toBe('Administrador');
    expect(result.current.permissions.professionals.read).toBe(true);
  });

  it('returns default permissions when user has no role assigned', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-no-role' } as any,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    mockSupabaseFrom.mockReturnValueOnce(
      buildQuery({ data: { role_id: null, allowed_departments: null }, error: null })
    );

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.permissions.professionals.create).toBe(false);
    expect(result.current.roleName).toBe('');
  });

  it('hasPermission returns true for valid permission', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123' } as any,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    mockSupabaseFrom
      .mockReturnValueOnce(
        buildQuery({ data: { role_id: 'role-1', allowed_departments: null }, error: null })
      )
      .mockReturnValueOnce(
        buildQuery({ data: { name: 'Administrador', permissions: adminPermissions }, error: null })
      );

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasPermission('professionals', 'create')).toBe(true);
    expect(result.current.hasPermission('reports', 'export')).toBe(true);
  });

  it('hasPermission returns false for unknown module', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasPermission('unknown_module' as any, 'read')).toBe(false);
  });

  it('canAccessDepartment returns true when no restrictions', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canAccessDepartment('any-dept-id')).toBe(true);
  });

  it('canAccessDepartment returns true when dept is in allowed list', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-restricted' } as any,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    mockSupabaseFrom
      .mockReturnValueOnce(
        buildQuery({
          data: { role_id: 'role-1', allowed_departments: ['dept-a', 'dept-b'] },
          error: null,
        })
      )
      .mockReturnValueOnce(
        buildQuery({ data: { name: 'Gestor', permissions: adminPermissions }, error: null })
      );

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canAccessDepartment('dept-a')).toBe(true);
    expect(result.current.canAccessDepartment('dept-c')).toBe(false);
  });

  it('isAdmin returns true when role is Administrador', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-admin' } as any,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    mockSupabaseFrom
      .mockReturnValueOnce(
        buildQuery({ data: { role_id: 'role-admin', allowed_departments: null }, error: null })
      )
      .mockReturnValueOnce(
        buildQuery({ data: { name: 'Administrador', permissions: adminPermissions }, error: null })
      );

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAdmin()).toBe(true);
  });

  it('isAdmin returns false when role is not Administrador', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-manager' } as any,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    mockSupabaseFrom
      .mockReturnValueOnce(
        buildQuery({ data: { role_id: 'role-mgr', allowed_departments: null }, error: null })
      )
      .mockReturnValueOnce(
        buildQuery({ data: { name: 'Gestor', permissions: adminPermissions }, error: null })
      );

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAdmin()).toBe(false);
  });

  it('canCreate, canRead, canUpdate, canDelete delegate to hasPermission', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123' } as any,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    mockSupabaseFrom
      .mockReturnValueOnce(
        buildQuery({ data: { role_id: 'role-1', allowed_departments: null }, error: null })
      )
      .mockReturnValueOnce(
        buildQuery({ data: { name: 'Administrador', permissions: adminPermissions }, error: null })
      );

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canCreate('professionals')).toBe(true);
    expect(result.current.canRead('professionals')).toBe(true);
    expect(result.current.canUpdate('professionals')).toBe(true);
    expect(result.current.canDelete('professionals')).toBe(true);
    expect(result.current.canApprove('swaps')).toBe(true);
    expect(result.current.canExport('reports')).toBe(true);
  });

  it('sets loading to false after permissions are resolved', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
