interface MonthlyBucket {
  _id: { year: number; month: number };
  total: number;
}

export interface FinanceTrendPoint {
  name: string;
  donations: number;
  expenses: number;
}

/** Merge the two monthly series onto one timeline so a month present in only one of them still lines up at zero. */
export function buildFinanceTrend(
  donationsByMonth: MonthlyBucket[] | undefined,
  expensesByMonth: MonthlyBucket[] | undefined,
  months = 12
): FinanceTrendPoint[] {
  const buckets = new Map<number, FinanceTrendPoint & { sort: number }>();

  const add = (rows: MonthlyBucket[] | undefined, key: 'donations' | 'expenses') => {
    for (const row of rows || []) {
      const year = row?._id?.year;
      const month = row?._id?.month;
      if (!year || !month) continue;

      const sort = year * 12 + month;
      const entry = buckets.get(sort) || { name: `${month}/${year}`, sort, donations: 0, expenses: 0 };
      entry[key] = row.total || 0;
      buckets.set(sort, entry);
    }
  };

  add(donationsByMonth, 'donations');
  add(expensesByMonth, 'expenses');

  return [...buckets.values()]
    .sort((a, b) => a.sort - b.sort)
    .slice(-months)
    .map(({ name, donations, expenses }) => ({ name, donations, expenses }));
}
