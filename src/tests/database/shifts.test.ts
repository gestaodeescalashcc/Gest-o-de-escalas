import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({ supabase: { from: mockFrom } }));
import { supabase } from '../../lib/supabase';

const buildChain = (result: unknown) => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(result),
  maybeSingle: vi.fn().mockResolvedValue(result),
  then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
});

const makeShift = (overrides = {}) => ({
  id: 'shift-1',
  professional_id: 'prof-1',
  department_id: 'dept-1',
  schedule_id: 'sched-1',
  shift_date: '2025-06-01',
  shift_type: 'SN',
  status: 'Agendado',
  created_by: 'user-1',
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('Shifts - List by date', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches shifts for a specific date', async () => {
    const shifts = [makeShift(), makeShift({ id: 'shift-2', shift_type: 'SD' })];
    const chain = buildChain({ data: shifts, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('shifts')
      .select('*, professional:professionals(full_name), department:departments(name)')
      .eq('shift_date', '2025-06-01') as unknown as { data: typeof shifts; error: null };

    expect(mockFrom).toHaveBeenCalledWith('shifts');
    expect(chain.eq).toHaveBeenCalledWith('shift_date', '2025-06-01');
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('fetches shifts filtered by department', async () => {
    const shifts = [makeShift()];
    const chain = buildChain({ data: shifts, error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('shift_date', '2025-06-01')
      .eq('department_id', 'dept-1') as unknown as { data: typeof shifts };

    expect(chain.eq).toHaveBeenCalledWith('department_id', 'dept-1');
    expect(data).toHaveLength(1);
  });

  it('returns empty array when no shifts found', async () => {
    const chain = buildChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('shifts')
      .select('*')
      .eq('shift_date', '2025-12-31') as unknown as { data: unknown[] };

    expect(data).toHaveLength(0);
  });
});

describe('Shifts - Create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new shift successfully', async () => {
    const chain = buildChain({ data: [makeShift()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shifts')
      .insert({
        professional_id: 'prof-1',
        department_id: 'dept-1',
        schedule_id: 'sched-1',
        shift_date: '2025-06-01',
        shift_type: 'SN',
        status: 'Agendado',
        created_by: 'user-1',
      }) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledOnce();
    expect(error).toBeNull();
  });

  it('returns error when professional already has a shift on that date', async () => {
    const dbError = { message: 'duplicate shift for professional', code: '23505' };
    const chain = buildChain({ data: null, error: dbError });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shifts')
      .insert({ professional_id: 'prof-1', shift_date: '2025-06-01' }) as unknown as { error: typeof dbError };

    expect(error?.code).toBe('23505');
  });
});

describe('Shifts - Update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates shift type', async () => {
    const chain = buildChain({ data: [makeShift({ shift_type: 'SD' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shifts')
      .update({ shift_type: 'SD' })
      .eq('id', 'shift-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ shift_type: 'SD' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'shift-1');
    expect(error).toBeNull();
  });

  it('updates shift status', async () => {
    const chain = buildChain({ data: [makeShift({ status: 'Cancelado' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shifts')
      .update({ status: 'Cancelado' })
      .eq('id', 'shift-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ status: 'Cancelado' });
    expect(error).toBeNull();
  });
});

describe('Shifts - Delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a shift by id', async () => {
    const chain = buildChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shifts')
      .delete()
      .eq('id', 'shift-1') as unknown as { error: null };

    expect(chain.delete).toHaveBeenCalledOnce();
    expect(chain.eq).toHaveBeenCalledWith('id', 'shift-1');
    expect(error).toBeNull();
  });
});

describe('Monthly Schedules - Create and List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a monthly schedule', async () => {
    const chain = buildChain({ data: [{ id: 'sched-1' }], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('monthly_schedules')
      .insert({
        name: 'Escala Junho 2025',
        department_id: 'dept-1',
        month: '2025-06-01',
        created_by: 'user-1',
      }) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledOnce();
    expect(error).toBeNull();
  });

  it('fetches schedules for a specific month', async () => {
    const chain = buildChain({ data: [{ id: 'sched-1', month: '2025-06-01' }], error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('monthly_schedules')
      .select('id, department_id')
      .eq('month', '2025-06-01') as unknown as { data: { id: string; month: string }[] };

    expect(chain.eq).toHaveBeenCalledWith('month', '2025-06-01');
    expect(data).toHaveLength(1);
  });
});
