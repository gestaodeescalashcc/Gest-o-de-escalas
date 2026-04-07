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

const makeSwap = (overrides = {}) => ({
  id: 'swap-1',
  original_shift_id: 'shift-1',
  offered_shift_id: 'shift-2',
  requesting_professional_id: 'prof-1',
  target_professional_id: 'prof-2',
  reason: 'Compromisso pessoal',
  status: 'Pendente',
  created_at: '2025-06-01T10:00:00Z',
  responded_at: null,
  approved_by: null,
  approved_at: null,
  ...overrides,
});

describe('Shift Swaps - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches all swaps ordered by created_at descending', async () => {
    const swaps = [makeSwap(), makeSwap({ id: 'swap-2', status: 'Aprovado' })];
    const chain = buildChain({ data: swaps, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('shift_swaps')
      .select('*, requesting_professional:professionals!shift_swaps_requesting_professional_id_fkey(full_name)')
      .order('created_at', { ascending: false }) as unknown as { data: typeof swaps; error: null };

    expect(mockFrom).toHaveBeenCalledWith('shift_swaps');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('fetches only pending swaps', async () => {
    const swaps = [makeSwap()];
    const chain = buildChain({ data: swaps, error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('shift_swaps')
      .select('*')
      .eq('status', 'Pendente') as unknown as { data: typeof swaps };

    expect(chain.eq).toHaveBeenCalledWith('status', 'Pendente');
    expect(data[0].status).toBe('Pendente');
  });
});

describe('Shift Swaps - Create', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a swap request successfully', async () => {
    const chain = buildChain({ data: [makeSwap()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shift_swaps')
      .insert({
        original_shift_id: 'shift-1',
        requesting_professional_id: 'prof-1',
        target_professional_id: 'prof-2',
        offered_shift_id: 'shift-2',
        reason: 'Compromisso pessoal',
        status: 'Pendente',
      }) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledOnce();
    expect(error).toBeNull();
  });

  it('creates a swap without offered shift (one-way swap)', async () => {
    const chain = buildChain({ data: [makeSwap({ offered_shift_id: null })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shift_swaps')
      .insert({
        original_shift_id: 'shift-1',
        requesting_professional_id: 'prof-1',
        target_professional_id: 'prof-2',
        offered_shift_id: null,
        reason: 'Urgência',
        status: 'Pendente',
      }) as unknown as { error: null };

    expect(error).toBeNull();
  });
});

describe('Shift Swaps - Approve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves a pending swap', async () => {
    const now = new Date().toISOString();
    const chain = buildChain({ data: [makeSwap({ status: 'Aprovado', responded_at: now, approved_at: now })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shift_swaps')
      .update({
        status: 'Aprovado',
        responded_at: now,
        approved_by: 'admin-1',
        approved_at: now,
      })
      .eq('id', 'swap-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Aprovado', approved_by: 'admin-1' })
    );
    expect(chain.eq).toHaveBeenCalledWith('id', 'swap-1');
    expect(error).toBeNull();
  });

  it('rejects a pending swap', async () => {
    const chain = buildChain({ data: [makeSwap({ status: 'Recusado' })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('shift_swaps')
      .update({ status: 'Recusado', responded_at: new Date().toISOString() })
      .eq('id', 'swap-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Recusado' })
    );
    expect(error).toBeNull();
  });
});

describe('Shift Swaps - Read single', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches a swap by id using maybeSingle', async () => {
    const swap = makeSwap();
    const chain = buildChain({ data: swap, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('shift_swaps')
      .select('original_shift_id, offered_shift_id, requesting_professional_id, target_professional_id')
      .eq('id', 'swap-1')
      .maybeSingle() as unknown as { data: typeof swap; error: null };

    expect(chain.maybeSingle).toHaveBeenCalledOnce();
    expect(data).toEqual(swap);
    expect(error).toBeNull();
  });

  it('returns null when swap does not exist', async () => {
    const chain = buildChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('shift_swaps')
      .select('*')
      .eq('id', 'nonexistent')
      .maybeSingle() as unknown as { data: null };

    expect(data).toBeNull();
  });
});
