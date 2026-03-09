import { Event, IEventDocument } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';

interface ListEventsQuery {
  page?: string;
  limit?: string;
  type?: string;
  status?: string;
  search?: string;
}

export class EventService {
  async list(query: ListEventsQuery, isPublicOnly = true) {
    const { page, limit } = parsePagination(query);
    const filter: FilterQuery<IEventDocument> = { isDeleted: false };

    if (isPublicOnly) filter.isPublic = true;
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('createdBy', 'name avatar')
        .populate('committee', 'name')
        .sort({ startDate: -1 })
        .skip(getSkip({ page, limit }))
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return { events, total, page, limit };
  }

  async getById(id: string): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: id, isDeleted: false })
      .populate('createdBy', 'name avatar')
      .populate('committee', 'name')
      .populate('registeredUsers', 'name avatar department batch');
    if (!event) throw ApiError.notFound('Event not found');
    return event;
  }

  async create(data: any, createdBy: string): Promise<IEventDocument> {
    return Event.create({ ...data, createdBy });
  }

  async update(id: string, data: any): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: id, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');
    Object.assign(event, data);
    await event.save();
    return event;
  }

  async delete(id: string): Promise<void> {
    const event = await Event.findOne({ _id: id, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');
    event.isDeleted = true;
    await event.save();
  }

  async register(eventId: string, userId: string): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');
    if (!event.registrationRequired) throw ApiError.badRequest('Registration not required for this event');
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw ApiError.badRequest('Registration deadline has passed');
    }
    if (event.maxParticipants && event.registeredUsers.length >= event.maxParticipants) {
      throw ApiError.badRequest('Event is full');
    }

    const oid = new mongoose.Types.ObjectId(userId);
    if (event.registeredUsers.some((u) => u.toString() === userId)) {
      throw ApiError.conflict('Already registered for this event');
    }

    event.registeredUsers.push(oid);
    await event.save();
    return event;
  }

  async submitAttendance(eventId: string, userId: string, via: 'qr' | 'manual', verifiedBy?: string): Promise<void> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const alreadyCheckedIn = event.attendance.some((a) => a.user.toString() === userId);
    if (alreadyCheckedIn) throw ApiError.conflict('Already checked in');

    event.attendance.push({
      user: new mongoose.Types.ObjectId(userId),
      checkedInAt: new Date(),
      checkedInVia: via,
      verifiedBy: verifiedBy ? new mongoose.Types.ObjectId(verifiedBy) : undefined,
    } as any);
    await event.save();
  }

  async submitFeedback(eventId: string, userId: string, rating: number, comment?: string): Promise<void> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');
    if (!event.feedbackEnabled) throw ApiError.badRequest('Feedback not enabled');

    const existing = event.feedbacks.find((f) => f.user.toString() === userId);
    if (existing) throw ApiError.conflict('Feedback already submitted');

    event.feedbacks.push({
      user: new mongoose.Types.ObjectId(userId),
      rating,
      comment,
      submittedAt: new Date(),
    } as any);
    await event.save();
  }

  async getAttendance(eventId: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false })
      .populate('attendance.user', 'name avatar department batch studentId')
      .populate('attendance.verifiedBy', 'name');
    if (!event) throw ApiError.notFound('Event not found');
    return event.attendance;
  }
}

export const eventService = new EventService();
