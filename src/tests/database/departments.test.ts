import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({ supabase: { from: mockFrom } }));
import { supabase } from '../../lib/supabase';

const buildChain = (result: unknown) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(result),
  maybeSingle: vi.fn().mockResolvedValue(result),
  then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
});

const makeDepartment = (overrides = {}) => ({
  id: 'dept-1',
  name: 'UTI Adulto',
  active: true,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('Departments - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches all departments ordered by name', async () => {
    const departments = [makeDepartment(), makeDepartment({ id: 'dept-2', name: 'Pediatria' })];
    const chain = buildChain({ data: departments, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('departments')
      .select('id, name')
      .order('name') as unknown as { data: typeof departments; error: null };

    expect(mockFrom).toHaveBeenCalledWith('departments');
    expect(chain.order).toHaveBeenCalledWith('name');
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('UTI Adulto');
  });

  it('returns empty array when no departments exist', async () => {
    const chain = buildChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('departments')
      .select('id, name')
      .order('name') as unknown as { data: unknown[] };

    expect(data).toHaveLength(0);
  });
});

describe('Departments - Create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a new department', async () => {
    const chain = buildChain({ data: [makeDepartment()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('departments')
      .insert({ name: 'UTI Adulto', active: true }) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledWith({ name: 'UTI Adulto', active: true });
    expect(error).toBeNull();
  });

  it('returns error on duplicate department name', async () => {
    const dbError = { message: 'duplicate key', code: '23505' };
    const chain = buildChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('departments')
      .insert({ name: 'UTI Adulto' }) as unknown as { error: typeof dbError };

    expect(error?.code).toBe('23505');
  });
});

describe('Departments - Update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates department name', async () => {
    const chain = buildChain({ data: [makeDepartment({ name: 'UTI Neonatal' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('departments')
      .update({ name: 'UTI Neonatal' })
      .eq('id', 'dept-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ name: 'UTI Neonatal' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'dept-1');
    expect(error).toBeNull();
  });
});

describe('Departments - Delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a department by id', async () => {
    const chain = buildChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', 'dept-1') as unknown as { error: null };

    expect(chain.delete).toHaveBeenCalledOnce();
    expect(chain.eq).toHaveBeenCalledWith('id', 'dept-1');
    expect(error).toBeNull();
  });

  it('returns error when deleting a department with linked professionals', async () => {
    const dbError = { message: 'foreign key constraint violation', code: '23503' };
    const chain = buildChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('departments')
      .delete()
      .eq('id', 'dept-with-profs') as unknown as { error: typeof dbError };

    expect(error?.code).toBe('23503');
  });
});
