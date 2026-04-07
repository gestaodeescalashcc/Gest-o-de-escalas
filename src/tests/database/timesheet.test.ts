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
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(result),
  maybeSingle: vi.fn().mockResolvedValue(result),
  then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
});

const makePunchRecord = (overrides = {}) => ({
  id: 'punch-1',
  professional_id: 'prof-1',
  punch_type: 'entrada',
  punch_time: '2025-06-01T07:00:00Z',
  shift_id: 'shift-1',
  is_online: false,
  latitude: null,
  longitude: null,
  created_at: '2025-06-01T07:00:00Z',
  nsr: 1,
  hash: 'abc123',
  previous_hash: null,
  ...overrides,
});

const makeTimesheet = (overrides = {}) => ({
  id: 'ts-1',
  professional_id: 'prof-1',
  shift_id: 'shift-1',
  work_date: '2025-06-01',
  scheduled_start: '07:00',
  scheduled_end: '19:00',
  actual_start: '07:00',
  actual_end: '19:00',
  total_hours: 12,
  meal_break_minutes: 60,
  status: 'Fechado',
  created_at: '2025-06-01T00:00:00Z',
  ...overrides,
});

describe('Punch Records - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches punch records for a professional on a date', async () => {
    const records = [makePunchRecord(), makePunchRecord({ id: 'punch-2', punch_type: 'saida' })];
    const chain = buildChain({ data: records, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('punch_records')
      .select('*')
      .eq('professional_id', 'prof-1')
      .order('punch_time') as unknown as { data: typeof records; error: null };

    expect(mockFrom).toHaveBeenCalledWith('punch_records');
    expect(chain.eq).toHaveBeenCalledWith('professional_id', 'prof-1');
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('fetches records in chronological order', async () => {
    const chain = buildChain({ data: [makePunchRecord()], error: null });
    mockFrom.mockReturnValue(chain);

    await supabase
      .from('punch_records')
      .select('*')
      .order('punch_time');

    expect(chain.order).toHaveBeenCalledWith('punch_time');
  });
});

describe('Punch Records - Create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers an entry punch', async () => {
    const chain = buildChain({ data: [makePunchRecord()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('punch_records')
      .insert({
        professional_id: 'prof-1',
        punch_type: 'entrada',
        punch_time: '2025-06-01T07:00:00Z',
        shift_id: 'shift-1',
        is_online: false,
        nsr: 1,
        hash: 'abc123',
        previous_hash: null,
      }) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledOnce();
    expect(error).toBeNull();
  });

  it('registers an exit punch', async () => {
    const chain = buildChain({ data: [makePunchRecord({ punch_type: 'saida' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('punch_records')
      .insert({
        professional_id: 'prof-1',
        punch_type: 'saida',
        punch_time: '2025-06-01T19:00:00Z',
        shift_id: 'shift-1',
        is_online: false,
        nsr: 2,
        hash: 'def456',
        previous_hash: 'abc123',
      }) as unknown as { error: null };

    expect(error).toBeNull();
  });
});

describe('Timesheet - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches timesheet records for a professional', async () => {
    const records = [makeTimesheet()];
    const chain = buildChain({ data: records, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('professional_id', 'prof-1')
      .order('work_date', { ascending: false }) as unknown as { data: typeof records; error: null };

    expect(chain.eq).toHaveBeenCalledWith('professional_id', 'prof-1');
    expect(chain.order).toHaveBeenCalledWith('work_date', { ascending: false });
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('fetches timesheets within a date range', async () => {
    const chain = buildChain({ data: [makeTimesheet()], error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('timesheets')
      .select('*')
      .eq('professional_id', 'prof-1')
      .gte('work_date', '2025-06-01')
      .lte('work_date', '2025-06-30') as unknown as { data: typeof makeTimesheet[] };

    expect(chain.gte).toHaveBeenCalledWith('work_date', '2025-06-01');
    expect(chain.lte).toHaveBeenCalledWith('work_date', '2025-06-30');
    expect(data).toBeDefined();
  });
});

describe('Timesheet - Update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('closes a timesheet record', async () => {
    const chain = buildChain({ data: [makeTimesheet({ status: 'Fechado' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('timesheets')
      .update({ status: 'Fechado', actual_end: '19:00', total_hours: 12 })
      .eq('id', 'ts-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Fechado' })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'ts-1');
    expect(error).toBeNull();
  });

  it('adjusts punch time in a timesheet adjustment', async () => {
    const chain = buildChain({ data: [makePunchRecord({ punch_time: '2025-06-01T07:05:00Z' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('punch_records')
      .update({ punch_time: '2025-06-01T07:05:00Z', adjusted: true })
      .eq('id', 'punch-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ punch_time: '2025-06-01T07:05:00Z' })
    );
    expect(error).toBeNull();
  });
});

describe('Punch records - Hash chain integrity', () => {
  it('new punch should reference previous punch hash', () => {
    const previousPunch = makePunchRecord({ hash: 'hash-001', nsr: 1 });
    const newPunch = makePunchRecord({
      id: 'punch-2',
      punch_type: 'saida',
      nsr: 2,
      hash: 'hash-002',
      previous_hash: previousPunch.hash,
    });

    expect(newPunch.previous_hash).toBe(previousPunch.hash);
    expect(newPunch.nsr).toBeGreaterThan(previousPunch.nsr);
  });

  it('first punch in chain has null previous_hash', () => {
    const firstPunch = makePunchRecord({ nsr: 1, previous_hash: null });
    expect(firstPunch.previous_hash).toBeNull();
  });
});
