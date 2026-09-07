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

/** One line of the spending details, whose amounts the server totals so the two can never disagree. */
const expenseItemSchema = z.object({
  head: z.string().trim().min(1, 'Every cost needs a name').max(200),
  amount: z.number().positive('Every cost needs an amount above zero'),
  note: z.string().trim().max(500).optional(),
});

const expenseAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(300),
  url: z.string().url('Invalid document URL'),
  type: z.string().trim().max(120).optional(),
});

export const createExpenseSchema = z.object({
  title: z.string().trim().min(1, 'Expense title is required'),
  description: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  category: z.enum(['event', 'office', 'transport', 'food', 'printing', 'other']).optional(),
  expenseDate: expenseDateField,
  items: z.array(expenseItemSchema).max(50, 'An expense can hold at most 50 costs').optional(),
  attachments: z.array(expenseAttachmentSchema).max(20, 'An expense can hold at most 20 documents').optional(),
  event: linkField('event'),
  committee: linkField('committee'),
  receiptUrl: z.string().optional(),
});

/** Every field is editable on its own, so a recorded expense can be corrected without resending the rest. */
export const updateExpenseSchema = createExpenseSchema.partial();
