import { describe, it, expect } from 'vitest';
import { buildFinanceTrend } from '@/lib/financeTrend';

const month = (year: number, m: number, total: number) => ({ _id: { year, month: m }, total });

describe('buildFinanceTrend', () => {
  it('lines both series up on the months they share', () => {
    expect(
      buildFinanceTrend([month(2026, 8, 5000)], [month(2026, 8, 1200)])
    ).toEqual([{ name: '8/2026', donations: 5000, expenses: 1200 }]);
  });

  it('fills in zero for a month only one series reports', () => {
    expect(
      buildFinanceTrend([month(2026, 7, 3000), month(2026, 8, 5000)], [month(2026, 8, 1200)])
    ).toEqual([
      { name: '7/2026', donations: 3000, expenses: 0 },
      { name: '8/2026', donations: 5000, expenses: 1200 },
    ]);
  });

  it('shows an expense-only month rather than dropping it', () => {
    // This is the case that would otherwise hide expenses made before any donation came in.
    expect(buildFinanceTrend([], [month(2026, 8, 1200)])).toEqual([
      { name: '8/2026', donations: 0, expenses: 1200 },
    ]);
  });

  it('sorts oldest to newest across a year boundary', () => {
    const points = buildFinanceTrend(
      [month(2026, 1, 10), month(2025, 12, 20), month(2025, 11, 30)],
      []
    );
    expect(points.map((p) => p.name)).toEqual(['11/2025', '12/2025', '1/2026']);
  });

  it('keeps only the most recent months asked for', () => {
    const rows = Array.from({ length: 20 }, (_, i) => month(2025, i + 1, i));
    const points = buildFinanceTrend(rows, [], 12);
    expect(points).toHaveLength(12);
    expect(points[0].name).toBe('9/2025');
  });

  it('treats a missing series as empty rather than throwing', () => {
    // An older API build sends no expensesByMonth at all.
    expect(buildFinanceTrend([month(2026, 8, 500)], undefined)).toEqual([
      { name: '8/2026', donations: 500, expenses: 0 },
    ]);
    expect(buildFinanceTrend(undefined, undefined)).toEqual([]);
  });

  it('skips malformed buckets instead of producing a NaN month', () => {
    expect(buildFinanceTrend([{ _id: {} } as any, month(2026, 8, 500)], [])).toEqual([
      { name: '8/2026', donations: 500, expenses: 0 },
    ]);
  });

  it('reads a missing total as zero', () => {
    expect(buildFinanceTrend([{ _id: { year: 2026, month: 8 } } as any], [])).toEqual([
      { name: '8/2026', donations: 0, expenses: 0 },
    ]);
  });
});
