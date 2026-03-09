import { z } from 'zod';

export const createVoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  options: z.array(z.object({ text: z.string().min(1) })).min(2, 'At least 2 options required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  eligibleVoters: z.enum(['all_members', 'batch_specific', 'role_specific']).optional(),
  eligibleBatches: z.array(z.number()).optional(),
  eligibleRoles: z.array(z.string()).optional(),
});

export const updateVoteSchema = createVoteSchema.partial();

export const castVoteSchema = z.object({
  optionId: z.string().min(1, 'Option ID is required'),
});
