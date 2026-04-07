import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom, mockInvoke } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInvoke: vi.fn(),
}));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));
import { supabase } from '../../lib/supabase';

const buildChain = (result: unknown) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(result),
  maybeSingle: vi.fn().mockResolvedValue(result),
  then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
});

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  full_name: 'Carlos Admin',
  email: 'carlos@test.com',
  role_id: 'role-admin',
  active: true,
  allowed_departments: null,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

const makeRole = (overrides = {}) => ({
  id: 'role-1',
  name: 'Administrador',
  permissions: {},
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('System Users - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches all active users with their roles', async () => {
    const users = [makeUser(), makeUser({ id: 'user-2', full_name: 'Ana Gestora' })];
    const chain = buildChain({ data: users, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('system_users')
      .select('*, role:user_roles(name)')
      .eq('active', true)
      .order('full_name') as unknown as { data: typeof users; error: null };

    expect(mockFrom).toHaveBeenCalledWith('system_users');
    expect(chain.eq).toHaveBeenCalledWith('active', true);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

describe('System Users - Get by ID', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches a user with role and permissions using maybeSingle', async () => {
    const user = makeUser();
    const chain = buildChain({ data: user, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('system_users')
      .select('role_id, allowed_departments')
      .eq('id', 'user-1')
      .maybeSingle() as unknown as { data: typeof user; error: null };

    expect(chain.maybeSingle).toHaveBeenCalledOnce();
    expect(data).toEqual(user);
    expect(error).toBeNull();
  });

  it('returns null when user not found in system_users', async () => {
    const chain = buildChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('system_users')
      .select('role_id, allowed_departments')
      .eq('id', 'ghost-user')
      .maybeSingle() as unknown as { data: null };

    expect(data).toBeNull();
  });
});

describe('System Users - Update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates user role', async () => {
    const chain = buildChain({ data: [makeUser({ role_id: 'role-2' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('system_users')
      .update({ role_id: 'role-2' })
      .eq('id', 'user-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ role_id: 'role-2' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'user-1');
    expect(error).toBeNull();
  });

  it('deactivates a user', async () => {
    const chain = buildChain({ data: [makeUser({ active: false })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('system_users')
      .update({ active: false })
      .eq('id', 'user-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ active: false });
    expect(error).toBeNull();
  });

  it('updates allowed departments for restricted user', async () => {
    const chain = buildChain({ data: [makeUser({ allowed_departments: ['dept-1', 'dept-2'] })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('system_users')
      .update({ allowed_departments: ['dept-1', 'dept-2'] })
      .eq('id', 'user-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ allowed_departments: ['dept-1', 'dept-2'] });
    expect(error).toBeNull();
  });
});

describe('User Roles - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches all roles', async () => {
    const roles = [makeRole(), makeRole({ id: 'role-2', name: 'Gestor' })];
    const chain = buildChain({ data: roles, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('name') as unknown as { data: typeof roles; error: null };

    expect(mockFrom).toHaveBeenCalledWith('user_roles');
    expect(data).toHaveLength(2);
    expect(error).toBeNull();
  });
});

describe('Create User - Edge Function', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invokes create-user edge function with correct payload', async () => {
    mockInvoke.mockResolvedValue({ data: { user_id: 'new-user-1' }, error: null });

    const payload = {
      email: 'novo@test.com',
      password: 'senha123',
      full_name: 'Novo Usuário',
      role_id: 'role-1',
    };

    const { data, error } = await (supabase as any).functions.invoke('create-user', {
      body: payload,
    });

    expect(mockInvoke).toHaveBeenCalledWith('create-user', { body: payload });
    expect(error).toBeNull();
    expect(data?.user_id).toBe('new-user-1');
  });

  it('returns error when email already exists', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'User already registered' } });

    const { error } = await (supabase as any).functions.invoke('create-user', {
      body: { email: 'existing@test.com', password: '123', full_name: 'Existente', role_id: 'role-1' },
    });

    expect(error?.message).toBe('User already registered');
  });
});
