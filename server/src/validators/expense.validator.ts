import { z } from 'zod';

/** Optional date the money was spent, defaulting server-side to now when omitted. */
const expenseDateField = z
  .string()
  .nullish()
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), { message: 'Invalid expense date' });

/** An id or '', since the forms send an empty string for "not linked". */
const linkField = (label: string) =>
  z
    .string()
    .refine((v) => v === '' || /^[0-9a-fA-F]{24}$/.test(v), { message: `Invalid ${label}` })
    .optional();

export const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Expense title is required'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  category: z.enum(['event', 'office', 'transport', 'food', 'printing', 'other']).optional(),
  expenseDate: expenseDateField,
  event: linkField('event'),
  committee: linkField('committee'),
  receiptUrl: z.string().optional(),
});

/** Every field is editable on its own, so a recorded expense can be corrected without resending the rest. */
export const updateExpenseSchema = createExpenseSchema.partial();
