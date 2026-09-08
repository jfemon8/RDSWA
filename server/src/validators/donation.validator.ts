import { z } from 'zod';

/** Optional date the donation happened, defaulting server-side to now when omitted. */
const donationDateField = z
  .string()
  .nullish()
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), { message: 'Invalid donation date' });

const objectIdOrEmpty = z
  .string()
  .refine((v) => v === '' || /^[0-9a-fA-F]{24}$/.test(v), { message: 'Invalid donor' });

export const createDonationSchema = z.object({
  /** Admin-only attribution to a registered user, sent as '' for a donor with no account. */
  donor: objectIdOrEmpty.optional(),
  paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded', 'revision']).optional(),
  donationDate: donationDateField,
  donorName: z.string().optional(),
  donorEmail: z.string().email().optional().or(z.literal('')),
  donorPhone: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['one-time', 'monthly', 'event-based', 'construction-fund', 'membership']).optional(),
  campaign: z.string().optional(),
  event: z.string().optional(),
  paymentMethod: z.enum(['bkash', 'nagad', 'rocket', 'upay', 'bank', 'cash', 'other']),
  senderNumber: z.string().optional(),
  transactionId: z.string().optional(),
  senderBankName: z.string().optional(),
  senderAccountNumber: z.string().optional(),
  cashDate: z.string().optional(),
  cashTime: z.string().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  note: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: z.enum(['monthly', 'yearly']).optional(),
});

/** Every donation field is editable, so a record can be corrected whatever state it is in. */
export const updateDonationSchema = createDonationSchema.partial();

export const verifyDonationSchema = z.object({
  paymentStatus: z.enum(['completed', 'failed', 'refunded', 'revision']),
  revisionNote: z.string().optional(),
});

const campaignFields = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  targetAmount: z.number().positive(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const campaignDateRefine = (schema: any) => schema.refine(
  (d: any) => !d.startDate || !d.endDate || new Date(d.endDate) > new Date(d.startDate),
  { message: 'End date must be after start date', path: ['endDate'] },
);

export const createCampaignSchema = campaignDateRefine(campaignFields);

export const updateCampaignSchema = campaignDateRefine(
  campaignFields.partial().extend({ status: z.enum(['active', 'completed', 'cancelled']).optional() })
);
