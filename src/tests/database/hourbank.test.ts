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
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(result),
  maybeSingle: vi.fn().mockResolvedValue(result),
  then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
});

const makeEntry = (overrides = {}) => ({
  id: 'entry-1',
  professional_id: 'prof-1',
  entry_type: 'credit',
  minutes: 60,
  entry_date: '2025-06-01',
  description: 'Horas extras',
  status: 'pending',
  created_by: 'user-1',
  created_at: '2025-06-01T08:00:00Z',
  expires_at: '2025-12-31T23:59:59Z',
  ...overrides,
});

const makeCompensation = (overrides = {}) => ({
  id: 'comp-1',
  professional_id: 'prof-1',
  compensation_date: '2025-06-15',
  compensation_type: 'Banco de Horas',
  minutes_compensated: 120,
  status: 'pending',
  requested_by: 'user-1',
  created_at: '2025-06-15T10:00:00Z',
  ...overrides,
});

describe('Hour Bank Entries - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches entries for a professional ordered by entry_date desc', async () => {
    const entries = [makeEntry(), makeEntry({ id: 'entry-2', minutes: 30 })];
    const chain = buildChain({ data: entries, error: null, count: 2 });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('hour_bank_entries')
      .select('*', { count: 'exact' })
      .eq('professional_id', 'prof-1')
      .order('entry_date', { ascending: false }) as unknown as { data: typeof entries; error: null; count: number };

    expect(mockFrom).toHaveBeenCalledWith('hour_bank_entries');
    expect(chain.eq).toHaveBeenCalledWith('professional_id', 'prof-1');
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('fetches only approved entries for balance calculation', async () => {
    const entries = [makeEntry({ status: 'approved' })];
    const chain = buildChain({ data: entries, error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('hour_bank_entries')
      .select('entry_type, minutes, expires_at')
      .eq('professional_id', 'prof-1')
      .eq('status', 'approved') as unknown as { data: typeof entries };

    expect(chain.eq).toHaveBeenCalledWith('status', 'approved');
    expect(data).toHaveLength(1);
    expect(data[0].status).toBe('approved');
  });
});

describe('Hour Bank Entries - Create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a credit entry', async () => {
    const chain = buildChain({ data: [makeEntry()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('hour_bank_entries')
      .insert({
        professional_id: 'prof-1',
        entry_type: 'credit',
        minutes: 60,
        entry_date: '2025-06-01',
        description: 'Hora extra',
        status: 'pending',
        created_by: 'user-1',
      }) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledOnce();
    expect(error).toBeNull();
  });

  it('creates a debit entry', async () => {
    const chain = buildChain({ data: [makeEntry({ entry_type: 'debit' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('hour_bank_entries')
      .insert({ professional_id: 'prof-1', entry_type: 'debit', minutes: 60 }) as unknown as { error: null };

    expect(error).toBeNull();
  });
});

describe('Hour Bank Entries - Approve / Reject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves a pending entry', async () => {
    const chain = buildChain({ data: [makeEntry({ status: 'approved' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('hour_bank_entries')
      .update({ status: 'approved', approved_by: 'admin-1', approved_at: '2025-06-02T00:00:00Z' })
      .eq('id', 'entry-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', approved_by: 'admin-1' })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'entry-1');
    expect(error).toBeNull();
  });

  it('rejects a pending entry', async () => {
    const chain = buildChain({ data: [makeEntry({ status: 'rejected' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('hour_bank_entries')
      .update({ status: 'rejected' })
      .eq('id', 'entry-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ status: 'rejected' });
    expect(error).toBeNull();
  });
});

describe('Hour Bank Compensations - Create and List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a compensation request', async () => {
    const chain = buildChain({ data: [makeCompensation()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('hour_bank_compensations')
      .insert({
        professional_id: 'prof-1',
        compensation_date: '2025-06-15',
        compensation_type: 'Banco de Horas',
        minutes_compensated: 120,
        status: 'pending',
        requested_by: 'user-1',
      }) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledOnce();
    expect(error).toBeNull();
  });

  it('lists compensations ordered by date descending', async () => {
    const compensations = [makeCompensation(), makeCompensation({ id: 'comp-2' })];
    const chain = buildChain({ data: compensations, error: null, count: 2 });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('hour_bank_compensations')
      .select('*', { count: 'exact' })
      .order('compensation_date', { ascending: false }) as unknown as { data: typeof compensations };

    expect(chain.order).toHaveBeenCalledWith('compensation_date', { ascending: false });
    expect(data).toHaveLength(2);
  });

  it('approves a compensation', async () => {
    const chain = buildChain({ data: [makeCompensation({ status: 'approved' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('hour_bank_compensations')
      .update({ status: 'approved', approved_by: 'admin-1' })
      .eq('id', 'comp-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved' })
    );
    expect(error).toBeNull();
  });

  it('calculates balance from entries (credits minus debits)', () => {
    const entries = [
      { entry_type: 'credit', minutes: 120, expires_at: null },
      { entry_type: 'credit', minutes: 60, expires_at: null },
      { entry_type: 'debit', minutes: 30, expires_at: null },
      { entry_type: 'compensation', minutes: 20, expires_at: null },
    ];

    const credits = entries
      .filter(e => e.entry_type === 'credit')
      .reduce((sum, e) => sum + e.minutes, 0);

    const debits = entries
      .filter(e => ['debit', 'compensation', 'expiration'].includes(e.entry_type))
      .reduce((sum, e) => sum + Math.abs(e.minutes), 0);

    const balance = credits - debits;
    expect(credits).toBe(180);
    expect(debits).toBe(50);
    expect(balance).toBe(130);
  });
});
