import { Committee } from '../models';

export interface ExpenseLinkInput {
  expenseDate?: string | null;
  event?: string;
  committee?: string;
}

export interface ExpenseLinkFields {
  expenseDate?: Date;
  event?: unknown;
  committee?: unknown;
}

/** The breakdown's total, or null when there is no breakdown and the typed amount stands on its own. */
export function expenseTotal(items?: Array<{ amount?: number }> | null): number | null {
  if (!items || items.length === 0) return null;
  return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/** The id of the committee an unlinked expense belongs to, which is null while no committee is marked current. */
export async function currentCommitteeId(): Promise<string | null> {
  const committee = await Committee.findOne({ isCurrent: true, isDeleted: false }).select('_id').lean();
  return committee ? String(committee._id) : null;
}

/** Fill the three optional fields a form leaves blank with today's date, the current committee and no event, touching only what an update actually sent. */
export function resolveExpenseLinks(
  input: ExpenseLinkInput,
  currentCommittee: string | null,
  { isCreate }: { isCreate: boolean }
): ExpenseLinkFields {
  const fields: ExpenseLinkFields = {};

  if (isCreate || input.expenseDate) {
    fields.expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();
  }

  if (isCreate || input.event !== undefined) {
    fields.event = input.event || null;
  }

  if (isCreate || input.committee !== undefined) {
    fields.committee = input.committee || currentCommittee || null;
  }

  return fields;
}
