import { z } from 'zod';

export const createCommitteeSchema = z.object({
  name: z.string().min(1, 'Committee name is required').max(200),
  tenure: z.object({
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
  }),
  isCurrent: z.boolean().optional(),
  description: z.string().optional(),
  members: z.array(z.object({
    user: z.string().min(1, 'User ID is required'),
    position: z.string().min(1, 'Position is required'),
    positionBn: z.string().optional(),
    responsibilities: z.string().optional(),
  })).optional(),
});

export const updateCommitteeSchema = createCommitteeSchema.partial();

export const addCommitteeMemberSchema = z.object({
  user: z.string().min(1, 'User ID is required'),
  position: z.string().min(1, 'Position is required'),
  positionBn: z.string().optional(),
  responsibilities: z.string().optional(),
});
