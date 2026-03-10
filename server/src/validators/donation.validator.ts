import { z } from 'zod';

export const createDonationSchema = z.object({
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional(),
  donorPhone: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['one-time', 'monthly', 'event-based', 'construction-fund', 'membership']).optional(),
  campaign: z.string().optional(),
  paymentMethod: z.enum(['bkash', 'nagad', 'rocket', 'bank', 'cash', 'other']),
  senderNumber: z.string().optional(),
  transactionId: z.string().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  note: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.enum(['monthly', 'yearly']).optional(),
});

export const verifyDonationSchema = z.object({
  paymentStatus: z.enum(['completed', 'failed', 'refunded', 'revision']),
  revisionNote: z.string().optional(),
});

export const createCampaignSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  targetAmount: z.number().positive(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(['active', 'completed', 'cancelled']).optional(),
});
