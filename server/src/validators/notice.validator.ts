import { z } from 'zod';

export const createNoticeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  titleBn: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  category: z.enum(['general', 'academic', 'event', 'urgent', 'financial', 'other']).optional(),
  priority: z.enum(['normal', 'important', 'urgent']).optional(),
  status: z.enum(['draft', 'published']).optional(),
  isHighlighted: z.boolean().optional(),
  scheduledPublishAt: z.string().optional(),
});

export const updateNoticeSchema = createNoticeSchema.partial();
