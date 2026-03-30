import { z } from 'zod';

const attachmentSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

export const submitFormSchema = z.object({
  type: z.enum(['membership', 'construction_fund', 'alumni'], {
    required_error: 'Form type is required',
    invalid_type_error: 'Invalid form type',
  }),
  data: z.object({
    reason: z.string().min(1, 'Reason is required').max(2000, 'Reason must be under 2000 characters'),
  }).catchall(z.unknown()),
  attachments: z.array(attachmentSchema).default([]),
}).superRefine((val, ctx) => {
  if (val.type === 'membership') {
    // Membership requires: NID/Passport/Birth Certificate + University ID Card
    if (val.attachments.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Membership application requires NID/Passport/Birth Certificate and University ID Card uploads',
        path: ['attachments'],
      });
    }
  } else if (val.type === 'alumni') {
    // Alumni requires: Business ID Card/Trade Licence/Employee ID Card
    if (val.attachments.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Alumni application requires Business ID Card/Trade Licence/Employee ID Card upload',
        path: ['attachments'],
      });
    }
  }
});

export const reviewFormSchema = z.object({
  status: z.enum(['approved', 'rejected', 'under_review'], {
    required_error: 'Status is required',
  }),
  reviewComment: z.string().max(1000, 'Comment must be under 1000 characters').optional(),
});
