import mongoose from 'mongoose';
import { Committee } from '../models';

/** The date a money record belongs to, falling back for rows written before the explicit date field existed. */
export function effectiveDate(primary: string, fallback = '$createdAt') {
  return { $ifNull: [primary, fallback] };
}

/** Match fragment putting a record's effective date inside a half-open window. */
export function withinDates(primary: string, start: Date, end: Date) {
  return {
    $expr: {
      $and: [
        { $gte: [effectiveDate(primary), start] },
        { $lt: [effectiveDate(primary), end] },
      ],
    },
  };
}

export interface Tenure {
  start: Date;
  end: Date;
}

/** A committee's term as a half-open window, where a sitting committee runs to now. */
export async function committeeTenure(committeeId: string): Promise<Tenure | null> {
  if (!mongoose.Types.ObjectId.isValid(committeeId)) return null;
  const committee = await Committee.findOne({ _id: committeeId, isDeleted: false })
    .select('tenure')
    .lean();
  if (!committee?.tenure?.startDate) return null;

  return {
    start: new Date(committee.tenure.startDate),
    end: committee.tenure.endDate ? new Date(committee.tenure.endDate) : new Date(),
  };
}

/** Expenses carry an explicit committee, so a tagged one counts there and an untagged one falls to its date. */
export function expenseCommitteeMatch(committeeId: string, tenure: Tenure) {
  return {
    $or: [
      { committee: new mongoose.Types.ObjectId(committeeId) },
      { $and: [{ committee: null }, withinDates('$expenseDate', tenure.start, tenure.end)] },
    ],
  };
}

/** Adds conditions under `$and`, which keeps several `$expr` clauses from overwriting each other. */
export function addConditions(match: Record<string, any>, conditions: any[]): void {
  if (conditions.length === 0) return;
  match.$and = [...(match.$and || []), ...conditions];
}
