import mongoose from 'mongoose';
import { withinDates, effectiveDate, expenseCommitteeMatch, addConditions } from '../services/financeScope';

const COMMITTEE = '507f1f77bcf86cd799439011';
const tenure = { start: new Date('2025-01-18'), end: new Date('2026-01-18') };

describe('effectiveDate', () => {
  it('prefers the entered date and falls back for rows written before that field existed', () => {
    expect(effectiveDate('$donationDate')).toEqual({ $ifNull: ['$donationDate', '$createdAt'] });
  });
});

describe('withinDates', () => {
  it('builds a half-open window so a boundary date lands in exactly one period', () => {
    const m: any = withinDates('$expenseDate', tenure.start, tenure.end);
    expect(m.$expr.$and[0].$gte[1]).toEqual(tenure.start);
    expect(m.$expr.$and[1].$lt[1]).toEqual(tenure.end);
  });

  it('compares the effective date, not the raw field', () => {
    const m: any = withinDates('$donationDate', tenure.start, tenure.end);
    expect(m.$expr.$and[0].$gte[0]).toEqual({ $ifNull: ['$donationDate', '$createdAt'] });
  });
});

describe('expenseCommitteeMatch', () => {
  const match: any = expenseCommitteeMatch(COMMITTEE, tenure);

  it('counts an expense explicitly tagged to the committee', () => {
    expect(match.$or[0].committee).toEqual(new mongoose.Types.ObjectId(COMMITTEE));
  });

  it('falls back to the term dates only for an untagged expense', () => {
    // `committee: null` also matches rows where the field was never written.
    expect(match.$or[1].$and[0]).toEqual({ committee: null });
    expect(match.$or[1].$and[1].$expr).toBeDefined();
  });

  it('never lets the date rule override an explicit tag', () => {
    expect(match.$or).toHaveLength(2);
    expect(match.$or[0].committee).toBeDefined();
  });
});

describe('addConditions', () => {
  it('leaves the match untouched when there is nothing to add', () => {
    const m: any = { isDeleted: false };
    addConditions(m, []);
    expect(m).toEqual({ isDeleted: false });
  });

  it('stacks conditions under $and so two $expr clauses cannot overwrite each other', () => {
    const m: any = { isDeleted: false };
    addConditions(m, [withinDates('$expenseDate', tenure.start, tenure.end)]);
    addConditions(m, [expenseCommitteeMatch(COMMITTEE, tenure)]);
    expect(m.$and).toHaveLength(2);
    expect(m.$expr).toBeUndefined();
  });
});
