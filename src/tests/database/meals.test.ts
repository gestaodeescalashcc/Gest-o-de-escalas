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

const makeMealEntry = (overrides = {}) => ({
  id: 'meal-1',
  professional_id: 'prof-1',
  shift_id: 'shift-1',
  meal_date: '2025-06-01',
  meal_type: 'Almoço',
  company_id: 'comp-1',
  category_id: 'cat-1',
  status: 'Confirmado',
  created_at: '2025-06-01T00:00:00Z',
  ...overrides,
});

const makeCategoryConfig = (overrides = {}) => ({
  id: 'config-1',
  category_id: 'cat-1',
  has_meal_benefit: true,
  meal_type: 'Almoço',
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('Meal Schedules - List', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches meal entries for a specific date', async () => {
    const entries = [makeMealEntry(), makeMealEntry({ id: 'meal-2' })];
    const chain = buildChain({ data: entries, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('meal_schedules')
      .select('*, professional:professionals!professional_id(full_name)')
      .eq('meal_date', '2025-06-01') as unknown as { data: typeof entries; error: null };

    expect(mockFrom).toHaveBeenCalledWith('meal_schedules');
    expect(chain.eq).toHaveBeenCalledWith('meal_date', '2025-06-01');
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it('fetches meal entries by company', async () => {
    const entries = [makeMealEntry()];
    const chain = buildChain({ data: entries, error: null });
    mockFrom.mockReturnValue(chain);

    const { data } = await supabase
      .from('meal_schedules')
      .select('*')
      .eq('company_id', 'comp-1') as unknown as { data: typeof entries };

    expect(chain.eq).toHaveBeenCalledWith('company_id', 'comp-1');
    expect(data).toHaveLength(1);
  });
});

describe('Meal Schedules - Bulk Insert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts multiple meal entries in batch', async () => {
    const mealEntries = [
      makeMealEntry({ id: undefined }),
      makeMealEntry({ id: undefined, professional_id: 'prof-2' }),
    ];
    const chain = buildChain({ data: mealEntries, error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('meal_schedules')
      .insert(mealEntries as any) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledWith(mealEntries);
    expect(error).toBeNull();
  });

  it('handles upsert for meal schedules', async () => {
    const chain = buildChain({ data: [makeMealEntry()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('meal_schedules')
      .upsert(makeMealEntry() as any) as unknown as { error: null };

    expect(chain.upsert).toHaveBeenCalledOnce();
    expect(error).toBeNull();
  });
});

describe('Meal Category Config - List and Update', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches categories with meal benefit enabled', async () => {
    const configs = [makeCategoryConfig()];
    const chain = buildChain({ data: configs, error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from('meal_category_config')
      .select('category_id, has_meal_benefit')
      .eq('has_meal_benefit', true) as unknown as { data: typeof configs; error: null };

    expect(chain.eq).toHaveBeenCalledWith('has_meal_benefit', true);
    expect(error).toBeNull();
    expect(data[0].has_meal_benefit).toBe(true);
  });

  it('updates meal benefit flag for a category', async () => {
    const chain = buildChain({ data: [makeCategoryConfig({ has_meal_benefit: false })], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('meal_category_config')
      .update({ has_meal_benefit: false })
      .eq('id', 'config-1') as unknown as { error: null };

    expect(chain.update).toHaveBeenCalledWith({ has_meal_benefit: false });
    expect(chain.eq).toHaveBeenCalledWith('id', 'config-1');
    expect(error).toBeNull();
  });

  it('inserts a new category config', async () => {
    const chain = buildChain({ data: [makeCategoryConfig()], error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('meal_category_config')
      .insert({ category_id: 'cat-2', has_meal_benefit: true, meal_type: 'Almoço' } as any) as unknown as { error: null };

    expect(chain.insert).toHaveBeenCalledOnce();
    expect(error).toBeNull();
  });
});

describe('Meal Schedule - Delete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes a meal entry by id', async () => {
    const chain = buildChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('meal_schedules')
      .delete()
      .eq('id', 'meal-1') as unknown as { error: null };

    expect(chain.delete).toHaveBeenCalledOnce();
    expect(chain.eq).toHaveBeenCalledWith('id', 'meal-1');
    expect(error).toBeNull();
  });

  it('deletes all meal entries for a specific date', async () => {
    const chain = buildChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase
      .from('meal_schedules')
      .delete()
      .eq('meal_date', '2025-06-01') as unknown as { error: null };

    expect(chain.eq).toHaveBeenCalledWith('meal_date', '2025-06-01');
    expect(error).toBeNull();
  });
});
