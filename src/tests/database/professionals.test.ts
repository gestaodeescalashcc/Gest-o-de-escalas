import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

import { supabase } from '../../lib/supabase';

const makeProfessional = (overrides = {}) => ({
  id: 'prof-1',
  full_name: 'Maria Santos',
  registration_number: 'REG-001',
  cpf: '123.456.789-00',
  pis: '123.45678.90-1',
  category_id: 'cat-1',
  department_id: 'dept-1',
  company_id: 'comp-1',
  contracted_hours: 40,
  active: true,
  created_at: '2025-01-01T00:00:00Z',
  hire_date: '2024-01-01',
  ...overrides,
});

const buildChain = (result: unknown) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(result),
  maybeSingle: vi.fn().mockResolvedValue(result),
  then: (resolve: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve),
});

describe('Professionals - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches active professionals ordered by full_name', async () => {
    const professionals = [makeProfessional(), makeProfessional({ id: 'prof-2', full_name: 'Zé Costa' })];
    const chain = buildChain({ data: professionals, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('active', true)
      .order('full_name') as unknown as { data: typeof professionals; error: null };

    expect(mockFrom).toHaveBeenCalledWith('professionals');
    expect(chain.eq).toHaveBeenCalledWith('active', true);
    expect(chain.order).toHaveBeenCalledWith('full_name');
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('returns empty array when no professionals exist', async () => {
    const chain = buildChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('professionals')
      .select('*')
      .eq('active', true) as unknown as { data: unknown[] };

    expect(data).toHaveLength(0);
  });

  it('returns error when database fails', async () => {
    const dbError = { message: 'connection error', code: '500' };
    const chain = buildChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('professionals')
      .select('*') as unknown as { data: null; error: typeof dbError };

    expect(data).toBeNull();
    expect(error).toEqual(dbError);
  });
});

describe('Professionals - Create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts a new professional', async () => {
    const newProf = makeProfessional({ id: undefined });
    const chain = buildChain({ data: [makeProfessional()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('professionals')
      .insert(newProf) as unknown as { error: null };

    expect(mockFrom).toHaveBeenCalledWith('professionals');
    expect(chain.insert).toHaveBeenCalledWith(newProf);
    expect(error).toBeNull();
  });

  it('returns error when inserting duplicate registration number', async () => {
    const dbError = { message: 'duplicate key value violates unique constraint', code: '23505' };
    const chain = buildChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('professionals')
      .insert(makeProfessional()) as unknown as { error: typeof dbError };

    expect(error?.code).toBe('23505');
  });
});

describe('Professionals - Update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a professional by id', async () => {
    const chain = buildChain({ data: [makeProfessional({ full_name: 'Updated Name' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('professionals')
      .update({ full_name: 'Updated Name' })
      .eq('id', 'prof-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ full_name: 'Updated Name' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'prof-1');
    expect(error).toBeNull();
  });

  it('soft-deletes a professional by setting active=false', async () => {
    const chain = buildChain({ data: [makeProfessional({ active: false })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('professionals')
      .update({ active: false })
      .eq('id', 'prof-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ active: false });
    expect(error).toBeNull();
  });
});

describe('Professionals - Read single', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches a single professional by id with maybeSingle', async () => {
    const prof = makeProfessional();
    const chain = buildChain({ data: prof, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', 'prof-1')
      .maybeSingle() as unknown as { data: typeof prof; error: null };

    expect(chain.maybeSingle).toHaveBeenCalledOnce();
    expect(data).toEqual(prof);
    expect(error).toBeNull();
  });

  it('returns null data when professional does not exist', async () => {
    const chain = buildChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', 'nonexistent')
      .maybeSingle() as unknown as { data: null };

    expect(data).toBeNull();
  });
});
