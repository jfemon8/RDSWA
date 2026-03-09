import { z } from 'zod';

export const createEventSchema = z.object({
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
});

export const updateEventSchema = createEventSchema.partial();

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});
