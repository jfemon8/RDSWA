import { z } from 'zod';

/** Notice attachment limited to one image or PDF, with the size cap enforced by both the upload form and the upload route. */
const noticeAttachmentSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  type: z.string().min(1).max(100),
});

export const createNoticeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  titleBn: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  category: z.enum(['general', 'academic', 'event', 'urgent', 'financial', 'other']).optional(),
  priority: z.enum(['normal', 'important', 'urgent']).optional(),
  // 'archived' is allowed on update so archived notices can still be edited;
  // creation forms only expose draft/published in the UI.
  status: z.enum(['draft', 'published', 'archived']).optional(),
  isHighlighted: z.boolean().optional(),
  scheduledPublishAt: z.string().optional(),
  // At most one attachment is allowed, with the array shape kept for backward compatibility.
  attachments: z.array(noticeAttachmentSchema).max(1, 'Only one attachment allowed').optional(),
});

export const updateNoticeSchema = createNoticeSchema.partial();
