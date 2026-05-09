import { z } from 'zod';

const baseEventShape = {
  title: z.string().min(1, 'Title is required').max(500),
  titleBn: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  type: z.enum(['event', 'meeting', 'workshop', 'seminar', 'social', 'other']).optional(),
  status: z.enum(['draft', 'upcoming', 'ongoing', 'completed', 'cancelled']).optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  venue: z.string().optional(),
  isOnline: z.boolean().optional(),
  onlineLink: z.string().url().optional().or(z.literal('')),
  registrationRequired: z.boolean().optional(),
  registrationDeadline: z.string().optional(),
  maxParticipants: z.number().int().positive().optional(),
  feedbackEnabled: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  committee: z.string().optional(),
};

/**
 * If both dates are present, end must be strictly after start. Compare as
 * Date objects so we accept any parseable string (ISO with offset, plain
 * datetime-local, etc.) — the client now sends UTC ISO; older clients may
 * still send timezone-less strings, both work here.
 */
const endAfterStart = (val: { startDate?: string; endDate?: string }, ctx: z.RefinementCtx) => {
  if (!val.startDate || !val.endDate) return;
  const s = new Date(val.startDate).getTime();
  const e = new Date(val.endDate).getTime();
  if (Number.isNaN(s) || Number.isNaN(e)) return; // leave parse errors to other guards
  if (e <= s) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be after the start date',
      path: ['endDate'],
    });
  }
};

export const createEventSchema = z.object(baseEventShape).superRefine(endAfterStart);

export const updateEventSchema = z.object(baseEventShape).partial().superRefine(endAfterStart);

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});
