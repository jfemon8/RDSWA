import { z } from 'zod';

const voteBaseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  options: z.array(z.object({ text: z.string().min(1) })).min(2, 'At least 2 options required'),
  startTime: z.string().min(1, 'Start time is required').refine(
    (val) => !isNaN(Date.parse(val)),
    'Start time must be a valid date'
  ),
  endTime: z.string().min(1, 'End time is required').refine(
    (val) => !isNaN(Date.parse(val)),
    'End time must be a valid date'
  ),
  eligibleVoters: z.enum(['all_members', 'batch_specific', 'role_specific']).optional(),
  eligibleBatches: z.array(z.number()).optional(),
  eligibleRoles: z.array(z.string()).optional(),
});

/** A restricted poll saved with an empty list would admit nobody, so the list it restricts by is required. */
function withEligibilityChecks<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (data: any) => data.eligibleVoters !== 'batch_specific' || (data.eligibleBatches || []).length > 0,
      { message: 'Pick at least one batch', path: ['eligibleBatches'] }
    )
    .refine(
      (data: any) => data.eligibleVoters !== 'role_specific' || (data.eligibleRoles || []).length > 0,
      { message: 'Pick at least one role', path: ['eligibleRoles'] }
    );
}

export const createVoteSchema = withEligibilityChecks(
  voteBaseSchema.refine(
    (data) => new Date(data.endTime) > new Date(data.startTime),
    { message: 'End time must be after start time', path: ['endTime'] }
  )
);

export const updateVoteSchema = withEligibilityChecks(
  voteBaseSchema.partial().refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return new Date(data.endTime) > new Date(data.startTime);
      }
      return true;
    },
    { message: 'End time must be after start time', path: ['endTime'] }
  )
);

export const castVoteSchema = z.object({
  optionId: z.string().min(1, 'Option ID is required'),
});
