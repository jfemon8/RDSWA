import { z } from 'zod';

/**
 * "YYYY-YY" — e.g. "2026-27". Two-digit suffix must be the next calendar
 * year mod 100, so "2026-26" or "2026-28" are rejected.
 */
const academicYearSchema = z.string()
  .regex(/^\d{4}-\d{2}$/, 'Academic year must be in YYYY-YY format (e.g. 2026-27)')
  .refine((v) => {
    const [start, suffix] = v.split('-');
    const next = (Number(start) + 1) % 100;
    return Number(suffix) === next;
  }, 'The two-digit suffix must be the next year (e.g. 2026-27, not 2026-26)');

const entrySchema = z.object({
  event: z.string().min(1, 'Event name is required').max(200),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  totalDays: z.number().int().min(0).optional(),
}).superRefine((val, ctx) => {
  const s = new Date(val.startDate).getTime();
  const e = new Date(val.endDate).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return;
  if (e < s) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date cannot be before the start date',
      path: ['endDate'],
    });
  }
});

const attachmentSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url(),
  type: z.string().min(1).max(50),
});

export const createVacationSchema = z.object({
  academicYear: academicYearSchema,
  notes: z.string().max(2000).optional(),
  entries: z.array(entrySchema).default([]),
  attachments: z.array(attachmentSchema).default([]),
});

export const updateVacationSchema = z.object({
  // Allow renaming the academic year (e.g. typo correction). Uniqueness is
  // enforced at the route handler against a partial unique index.
  academicYear: academicYearSchema.optional(),
  notes: z.string().max(2000).optional(),
  entries: z.array(entrySchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
});
