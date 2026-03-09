export type EventType = 'event' | 'meeting' | 'workshop' | 'seminar' | 'social' | 'other';
export type EventStatus = 'draft' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface IEvent {
  _id: string;
  title: string;
  titleBn?: string;
  description: string;
  type: EventType;
  status: EventStatus;
  startDate: string;
  endDate?: string;
  venue?: string;
  isOnline: boolean;
  onlineLink?: string;
  registrationRequired: boolean;
  registrationDeadline?: string;
  maxParticipants?: number;
  coverImage?: string;
  committee?: string;
  createdBy: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}
