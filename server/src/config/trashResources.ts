import { Model, FilterQuery } from 'mongoose';
import {
  AdmissionCircular,
  AdmissionCutoff,
  AdmissionSeat,
  Album,
  AnnouncementComment,
  Budget,
  BusCounter,
  BusOperator,
  BusReview,
  BusRoute,
  BusSchedule,
  ChatGroup,
  Committee,
  ContactMessage,
  DocumentModel,
  Donation,
  DonationCampaign,
  Event,
  Expense,
  Form,
  ForumReply,
  ForumTopic,
  JobPost,
  Message,
  Notice,
  Photo,
  Vacation,
  Vote,
} from '../models';

export interface TrashResource {
  /** URL segment and query key. */
  key: string;
  label: string;
  model: Model<any>;
  /** Fields the listing needs to describe a row. */
  select: string;
  /** One line naming the deleted record. */
  title: (doc: any) => string;
  /** Listed in the recycle bin, as opposed to only being swept up by retention. */
  recoverable: boolean;
  /** Records retention and the bin must never touch. */
  protect?: FilterQuery<any>;
}

const text = (value: unknown, fallback = 'Untitled'): string => {
  const str = typeof value === 'string' ? value.trim() : value == null ? '' : String(value);
  return str || fallback;
};

/** Every soft-deletable collection except users, whose own page carries the extra rules their lifecycle needs. */
export const TRASH_RESOURCES: TrashResource[] = [
  { key: 'notices', label: 'Notices', model: Notice, select: 'title status createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'events', label: 'Events', model: Event, select: 'title startDate createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'documents', label: 'Documents', model: DocumentModel, select: 'title createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'albums', label: 'Gallery albums', model: Album, select: 'title createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'photos', label: 'Gallery photos', model: Photo, select: 'caption createdAt deletedAt', title: (d) => text(d.caption, 'Untitled photo'), recoverable: true },
  { key: 'job-posts', label: 'Job posts', model: JobPost, select: 'title createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'committees', label: 'Committees', model: Committee, select: 'name createdAt deletedAt', title: (d) => text(d.name), recoverable: true },
  { key: 'votes', label: 'Votes', model: Vote, select: 'title createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'campaigns', label: 'Donation campaigns', model: DonationCampaign, select: 'title createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'donations', label: 'Donations', model: Donation, select: 'receiptNumber amount createdAt deletedAt', title: (d) => text(d.receiptNumber, `Donation of ${d.amount ?? '-'}`), recoverable: true },
  { key: 'expenses', label: 'Expenses', model: Expense, select: 'title amount createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'budgets', label: 'Budgets', model: Budget, select: 'title createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'vacations', label: 'Vacation calendars', model: Vacation, select: 'academicYear createdAt deletedAt', title: (d) => text(d.academicYear, 'Vacation calendar'), recoverable: true },
  { key: 'bus-operators', label: 'Bus operators', model: BusOperator, select: 'name createdAt deletedAt', title: (d) => text(d.name), recoverable: true },
  { key: 'bus-routes', label: 'Bus routes', model: BusRoute, select: 'origin destination createdAt deletedAt', title: (d) => `${text(d.origin, '?')} → ${text(d.destination, '?')}`, recoverable: true },
  { key: 'bus-schedules', label: 'Bus schedules', model: BusSchedule, select: 'departureTime arrivalTime createdAt deletedAt', title: (d) => `${text(d.departureTime, '?')} – ${text(d.arrivalTime, '?')}`, recoverable: true },
  { key: 'bus-counters', label: 'Bus counters', model: BusCounter, select: 'name createdAt deletedAt', title: (d) => text(d.name), recoverable: true },
  { key: 'admission-circulars', label: 'Admission circulars', model: AdmissionCircular, select: 'title createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'admission-seats', label: 'Admission seats', model: AdmissionSeat, select: 'category session createdAt deletedAt', title: (d) => `${text(d.category)} · ${text(d.session, 'no session')}`, recoverable: true },
  { key: 'admission-cutoffs', label: 'Admission cutoffs', model: AdmissionCutoff, select: 'department unit session createdAt deletedAt', title: (d) => `${text(d.department)} · ${text(d.session, 'no session')}`, recoverable: true },
  { key: 'forms', label: 'Form submissions', model: Form, select: 'type status createdAt deletedAt', title: (d) => `${text(d.type, 'Form')} · ${text(d.status, 'no status')}`, recoverable: true },
  { key: 'forum-topics', label: 'Forum topics', model: ForumTopic, select: 'title createdAt deletedAt', title: (d) => text(d.title), recoverable: true },
  { key: 'chat-groups', label: 'Chat groups', model: ChatGroup, select: 'name type createdAt deletedAt', title: (d) => text(d.name), recoverable: true },
  { key: 'contact-messages', label: 'Contact messages', model: ContactMessage, select: 'subject name createdAt deletedAt', title: (d) => text(d.subject, `Message from ${text(d.name, 'someone')}`), recoverable: true },

  // Swept up by retention but not worth listing one by one.
  { key: 'messages', label: 'Chat messages', model: Message, select: 'createdAt deletedAt', title: () => 'Message', recoverable: false },
  { key: 'forum-replies', label: 'Forum replies', model: ForumReply, select: 'createdAt deletedAt', title: () => 'Reply', recoverable: false },
  { key: 'announcement-comments', label: 'Announcement comments', model: AnnouncementComment, select: 'createdAt deletedAt', title: () => 'Comment', recoverable: false },
  { key: 'bus-reviews', label: 'Bus reviews', model: BusReview, select: 'createdAt deletedAt', title: () => 'Review', recoverable: false },
];

export const findTrashResource = (key: string): TrashResource | undefined =>
  TRASH_RESOURCES.find((r) => r.key === key);
