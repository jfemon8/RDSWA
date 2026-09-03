import { Event, IEventDocument } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import {
  deriveEventStatus,
  dhakaStartOfDay,
  getAttendanceWindow,
  resolveCheckedInAt,
  attendanceWindowClosedMessage,
} from '@rdswa/shared';

interface ListEventsQuery {
  page?: string;
  limit?: string;
  type?: string;
  status?: string;
  search?: string;
  upcoming?: string;
  committee?: string;
}

/** Status is derived from the dates at read time, honouring only `draft` and `cancelled` as stored admin overrides. */
function buildStatusDateFilter(status: string, now: Date): FilterQuery<IEventDocument> | null {
  // Dhaka-anchored so this filter selects the same events `deriveEventStatus` labels.
  const startOfToday = dhakaStartOfDay(now);

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

  /** Record a moderator-driven check-in, creating a record, promoting a pending self-request, or reporting a duplicate. */
  async submitAttendance(options: {
    eventId: string;
    userId: string;
    via: 'qr' | 'manual';
    verifiedBy?: string;
    actorRole?: string;
    checkedInAt?: string | Date | null;
  }): Promise<{ status: 'approved' | 'duplicate'; record: any }> {
    const { eventId, userId, via, verifiedBy, actorRole, checkedInAt } = options;

    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const existing = event.attendance.find((a) => a.user.toString() === userId);
    const verifierOid = verifiedBy ? new mongoose.Types.ObjectId(verifiedBy) : undefined;

    const resultStatus: 'approved' | 'duplicate' =
      existing?.status === 'approved' ? 'duplicate' : 'approved';

    // A duplicate writes nothing, so let the scanner warn even past the deadline.
    if (resultStatus !== 'duplicate') {
      const window = getAttendanceWindow(event, { role: actorRole });
      const resolved = resolveCheckedInAt({ supplied: checkedInAt, event, window });
      if (!resolved.ok) throw ApiError.badRequest(resolved.error!);

      if (existing) {
        // Promote pending → approved (the user previously self-requested).
        existing.status = 'approved';
        existing.checkedInVia = via;
        // Keep the member's stated date unless one was supplied here.
        if (checkedInAt) existing.checkedInAt = resolved.checkedInAt;
        if (verifierOid) existing.verifiedBy = verifierOid;
      } else {
        event.attendance.push({
          user: new mongoose.Types.ObjectId(userId),
          checkedInAt: resolved.checkedInAt,
          checkedInVia: via,
          verifiedBy: verifierOid,
          status: 'approved',
        } as any);
      }

      await event.save();
    }

    // Re-fetch populated so the scanner can show the attendee without a second query.
    const populated = await Event.findById(eventId)
      .select('attendance')
      .populate('attendance.user', 'name avatar department batch studentId')
      .populate('attendance.verifiedBy', 'name');

    const record = populated?.attendance.find(
      (a: any) => (a.user?._id?.toString() || a.user?.toString()) === userId
    );

    return { status: resultStatus, record };
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

  /** A member's own attendance claim, which lands as `pending` and uses the tightest window. */
  async selfCheckin(
    eventId: string,
    userId: string,
    checkedInAt?: string | Date | null
  ): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    // Checked before the window so an existing record reports itself, not the deadline.
    const already = event.attendance.some((a) => a.user.toString() === userId);
    if (already) throw ApiError.conflict('You have already checked in or have a pending request');

    const window = getAttendanceWindow(event, { isSelfCheckin: true });
    const resolved = resolveCheckedInAt({ supplied: checkedInAt, event, window });
    if (!resolved.ok) throw ApiError.badRequest(resolved.error!);

    event.attendance.push({
      user: new mongoose.Types.ObjectId(userId),
      checkedInAt: resolved.checkedInAt,
      checkedInVia: 'self',
      status: 'pending',
    } as any);
    await event.save();
    return event;
  }

  async bulkAttendance(options: {
    eventId: string;
    userIds: string[];
    verifiedBy: string;
    actorRole?: string;
    checkedInAt?: string | Date | null;
  }): Promise<IEventDocument> {
    const { eventId, userIds, verifiedBy, actorRole, checkedInAt } = options;

    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const window = getAttendanceWindow(event, { role: actorRole });
    const resolved = resolveCheckedInAt({ supplied: checkedInAt, event, window });
    if (!resolved.ok) throw ApiError.badRequest(resolved.error!);

    const verifierOid = new mongoose.Types.ObjectId(verifiedBy);
    for (const uid of userIds) {
      const existing = event.attendance.find((a) => a.user.toString() === uid);
      if (!existing) {
        event.attendance.push({
          user: new mongoose.Types.ObjectId(uid),
          checkedInAt: resolved.checkedInAt,
          checkedInVia: 'manual',
          verifiedBy: verifierOid,
          status: 'approved',
        } as any);
      } else if (existing.status === 'pending') {
        // Promote a pending self-request, keeping its date unless one was supplied here.
        existing.status = 'approved';
        existing.checkedInVia = 'manual';
        if (checkedInAt) existing.checkedInAt = resolved.checkedInAt;
        existing.verifiedBy = verifierOid;
      }
      // status === 'approved' → already done, leave untouched.
    }
    await event.save();
    return event;
  }

  /** Approve a pending self check-in, keeping the date the member recorded. */
  async approveAttendance(
    eventId: string,
    userId: string,
    verifiedBy: string,
    actorRole?: string
  ): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const window = getAttendanceWindow(event, { role: actorRole });
    if (!window.isOpen) throw ApiError.badRequest(attendanceWindowClosedMessage(window));

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
