import { z } from 'zod';

/** One admin-defined question shown on the registration form. */
const registrationFieldSchema = z.object({
  key: z.string().min(1, 'Field key is required').max(60),
  label: z.string().min(1, 'Field label is required').max(200),
  type: z.enum(['text', 'number', 'select']).optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
});

/**
 * Guards that keep a question set answerable, since a bad one silently blocks every registration.
 */
const registrationFieldsSchema = z
  .array(registrationFieldSchema)
  .max(20, 'A registration form is limited to 20 questions')
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();

    fields.forEach((field, i) => {
      // Duplicate keys would make one question's answer overwrite the other's.
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Two questions share the name "${field.label}", so give one a different name`,
          path: [i, 'key'],
        });
      }
      seen.add(field.key);

      // A required select with no options can never be satisfied.
      if (field.type === 'select' && !field.options?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${field.label}" is a dropdown, so it needs at least one option`,
          path: [i, 'options'],
        });
      }
    });
  });

const baseEventShape = {
  registrationFields: registrationFieldsSchema.optional(),
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

/** Require end to be strictly after start when both are present, comparing as Dates so any parseable string format works. */
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

/** Optional backdate; range rules live in `resolveCheckedInAt` so client and server agree. */
const checkedInAtField = z
  .string()
  .nullish()
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), {
    message: 'Invalid attendance date',
  });

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID');

export const checkinSchema = z.object({
  userId: objectId,
  method: z.enum(['qr', 'manual']).optional(),
  checkedInAt: checkedInAtField,
});

export const manualAttendanceSchema = z.object({
  userId: objectId,
  checkedInAt: checkedInAtField,
});

export const bulkAttendanceSchema = z.object({
  userIds: z.array(objectId).min(1, 'Select at least one member'),
  checkedInAt: checkedInAtField,
});

export const selfCheckinSchema = z.object({
  checkedInAt: checkedInAtField,
});

/** Answers to the event's custom questions, kept as plain strings. */
const registrationResponses = z.record(z.string(), z.string()).optional();

export const registerSchema = z.object({
  responses: registrationResponses,
});

const registrationStatus = z.enum(['confirmed', 'waitlisted', 'interested', 'cancelled']);

export const addRegistrationSchema = z.object({
  userId: objectId,
  status: registrationStatus.optional(),
  note: z.string().max(500).optional(),
  responses: registrationResponses,
});

export const updateRegistrationSchema = z.object({
  status: registrationStatus.optional(),
  note: z.string().max(500).optional(),
  responses: registrationResponses,
});
