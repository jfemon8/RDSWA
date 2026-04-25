import { Event, IEventDocument } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import { deriveEventStatus } from '@rdswa/shared';

interface ListEventsQuery {
  page?: string;
  limit?: string;
  type?: string;
  status?: string;
  search?: string;
  upcoming?: string;
  committee?: string;
}

/**
 * Status is derived from startDate/endDate at read time. `draft` and
 * `cancelled` remain honored as admin overrides; 'upcoming' / 'ongoing' /
 * 'completed' in the DB are ignored in favor of time-based derivation.
 * Events without an endDate are treated as lasting until the end of their
 * startDate's day.
 */
function buildStatusDateFilter(status: string, now: Date): FilterQuery<IEventDocument> | null {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (status === 'upcoming') {
    return { status: { $nin: ['draft', 'cancelled'] }, startDate: { $gt: now } };
  }
  if (status === 'ongoing') {
    return {
      status: { $nin: ['draft', 'cancelled'] },
      startDate: { $lte: now },
      $or: [
        { endDate: { $gte: now } },
        { $and: [{ endDate: { $in: [null, undefined] } }, { startDate: { $gte: startOfToday } }] },
      ],
    };
  }
  if (status === 'completed') {
    return {
      status: { $nin: ['draft', 'cancelled'] },
      $or: [
        { endDate: { $lt: now } },
        { $and: [{ endDate: { $in: [null, undefined] } }, { startDate: { $lt: startOfToday } }] },
      ],
    };
  }
  if (status === 'draft' || status === 'cancelled') {
    return { status };
  }
  return null;
}

/**
 * Combine two filter objects, merging their `$or` clauses under `$and` to
 * avoid key collision when both sides contribute an `$or`.
 */
function mergeFilters(a: FilterQuery<IEventDocument>, b: FilterQuery<IEventDocument>): FilterQuery<IEventDocument> {
  const { $or: aOr, ...aRest } = a as any;
  const { $or: bOr, ...bRest } = b as any;
  const merged: any = { ...aRest, ...bRest };
  const ors: any[] = [];
  if (aOr) ors.push({ $or: aOr });
  if (bOr) ors.push({ $or: bOr });
  if (ors.length === 2) {
    merged.$and = [...(merged.$and || []), ...ors];
  } else if (ors.length === 1) {
    merged.$or = ors[0].$or;
  }
  return merged;
}

function attachDerivedStatus<T extends { status?: string; startDate?: Date | string; endDate?: Date | string | null; toObject?: () => any }>(event: T, now: Date): any {
  const plain = typeof (event as any).toObject === 'function' ? (event as any).toObject({ virtuals: true }) : { ...event };
  plain.status = deriveEventStatus({
    startDate: plain.startDate,
    endDate: plain.endDate,
    status: plain.status,
    now,
  });
  return plain;
}

export class EventService {
  async list(query: ListEventsQuery, isPublicOnly = true) {
    const { page, limit } = parsePagination(query);
    const now = new Date();
    let filter: FilterQuery<IEventDocument> = { isDeleted: false };

    if (isPublicOnly) filter.isPublic = true;
    if (query.type) filter.type = query.type;
    if (query.committee && mongoose.isValidObjectId(query.committee)) {
      filter.committee = new mongoose.Types.ObjectId(query.committee);
    }
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const statusFilter = query.status
      ? buildStatusDateFilter(query.status, now)
      : query.upcoming === 'true'
        ? buildStatusDateFilter('upcoming', now)
        : null;
    if (statusFilter) filter = mergeFilters(filter, statusFilter);

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate('createdBy', 'name avatar')
        .populate('committee', 'name')
        .sort({ startDate: -1 })
        .skip(getSkip({ page, limit }))
        .limit(limit),
      Event.countDocuments(filter),
    ]);

    return {
      events: events.map((e) => attachDerivedStatus(e as any, now)),
      total,
      page,
      limit,
    };
  }

  async getById(id: string): Promise<any> {
    const event = await Event.findOne({ _id: id, isDeleted: false })
      .populate('createdBy', 'name avatar')
      .populate('committee', 'name')
      .populate('registeredUsers', 'name avatar department batch')
      .populate('attendance.user', 'name avatar department batch studentId')
      .populate('attendance.verifiedBy', 'name')
      .populate('photos.taggedUsers', 'name avatar');
    if (!event) throw ApiError.notFound('Event not found');
    return attachDerivedStatus(event as any, new Date());
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
      status: 'approved',
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

  async generateQrCode(eventId: string, baseUrl: string): Promise<string> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const checkinUrl = `${baseUrl}/events/${eventId}/checkin`;
    const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    event.qrCode = qrDataUrl;
    await event.save();
    return qrDataUrl;
  }

  async selfCheckin(eventId: string, userId: string): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const already = event.attendance.some((a) => a.user.toString() === userId);
    if (already) throw ApiError.conflict('You have already checked in or have a pending request');

    event.attendance.push({
      user: new mongoose.Types.ObjectId(userId),
      checkedInAt: new Date(),
      checkedInVia: 'self',
      status: 'pending',
    } as any);
    await event.save();
    return event;
  }

  async bulkAttendance(eventId: string, userIds: string[], verifiedBy: string): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    for (const uid of userIds) {
      const already = event.attendance.some((a) => a.user.toString() === uid);
      if (!already) {
        event.attendance.push({
          user: new mongoose.Types.ObjectId(uid),
          checkedInAt: new Date(),
          checkedInVia: 'manual',
          verifiedBy: new mongoose.Types.ObjectId(verifiedBy),
          status: 'approved',
        } as any);
      }
    }
    await event.save();
    return event;
  }

  async approveAttendance(eventId: string, userId: string, verifiedBy: string): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const record = event.attendance.find((a) => a.user.toString() === userId);
    if (!record) throw ApiError.notFound('Attendance record not found');

    record.status = 'approved';
    record.verifiedBy = new mongoose.Types.ObjectId(verifiedBy);
    await event.save();
    return event;
  }

  async removeAttendance(eventId: string, userId: string): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const idx = event.attendance.findIndex(
      (a) => a.user.toString() === userId
    );
    if (idx === -1) throw ApiError.notFound('Attendance record not found');

    event.attendance.splice(idx, 1);
    await event.save();
    return event;
  }

  async addReport(
    eventId: string,
    report: { name: string; url: string },
    uploadedBy: string
  ): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    if (!report.name || !report.url) throw ApiError.badRequest('Report name and URL are required');

    event.reports.push({
      name: report.name,
      url: report.url,
      uploadedBy: uploadedBy as any,
      uploadedAt: new Date(),
    });
    await event.save();
    return event;
  }

  async removeReport(eventId: string, reportIndex: number): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    if (reportIndex < 0 || reportIndex >= event.reports.length) {
      throw ApiError.badRequest('Invalid report index');
    }

    event.reports.splice(reportIndex, 1);
    await event.save();
    return event;
  }

  async addPhoto(
    eventId: string,
    photo: { url: string; caption?: string; taggedUsers?: string[] },
    uploadedBy: string
  ): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    event.photos.push({
      url: photo.url,
      caption: photo.caption,
      taggedUsers: (photo.taggedUsers || []).map((id) => new mongoose.Types.ObjectId(id)),
      uploadedBy: new mongoose.Types.ObjectId(uploadedBy),
    } as any);
    await event.save();
    return event;
  }

  async removePhoto(eventId: string, photoIndex: number): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');
    if (photoIndex < 0 || photoIndex >= event.photos.length) {
      throw ApiError.badRequest('Invalid photo index');
    }

    event.photos.splice(photoIndex, 1);
    await event.save();
    return event;
  }

  async tagUsersOnPhoto(
    eventId: string,
    photoIndex: number,
    userIds: string[]
  ): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');
    if (photoIndex < 0 || photoIndex >= event.photos.length) {
      throw ApiError.badRequest('Invalid photo index');
    }

    const photo = event.photos[photoIndex];
    const existingIds = new Set(photo.taggedUsers.map((u) => u.toString()));
    for (const id of userIds) {
      if (!existingIds.has(id)) {
        photo.taggedUsers.push(new mongoose.Types.ObjectId(id));
      }
    }
    await event.save();
    return event;
  }

  async getMyAttendance(userId: string) {
    const events = await Event.find({
      isDeleted: false,
      'attendance.user': new mongoose.Types.ObjectId(userId),
    })
      .select('title type status startDate endDate venue attendance')
      .sort({ startDate: -1 });

    const now = new Date();
    return events.map((event) => {
      const myRecord = event.attendance.find((a) => a.user.toString() === userId);
      return {
        _id: event._id,
        title: event.title,
        type: event.type,
        status: deriveEventStatus({
          startDate: event.startDate,
          endDate: event.endDate,
          status: event.status,
          now,
        }),
        startDate: event.startDate,
        endDate: event.endDate,
        venue: event.venue,
        checkedInAt: myRecord?.checkedInAt,
        checkedInVia: myRecord?.checkedInVia,
      };
    });
  }

  async untagUserFromPhoto(
    eventId: string,
    photoIndex: number,
    userId: string
  ): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');
    if (photoIndex < 0 || photoIndex >= event.photos.length) {
      throw ApiError.badRequest('Invalid photo index');
    }

    event.photos[photoIndex].taggedUsers = event.photos[photoIndex].taggedUsers.filter(
      (u) => u.toString() !== userId
    );
    await event.save();
    return event;
  }
}

export const eventService = new EventService();
