import { Event, IEventDocument, EventRegistrationStatus, Budget, Donation, Expense } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';
import QRCode from 'qrcode';
import { escapeRegex } from '../utils/escapeRegex';
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
  plain.registrationCounts = registrationCounts(plain.registrations || []);
  delete plain.registrations;
  return plain;
}

function registrantId(registration: any): string {
  const user = registration.user;
  return (user?._id ? user._id.toString() : user?.toString()) || '';
}

function findRegistration(event: IEventDocument, userId: string) {
  return event.registrations.find((r) => registrantId(r) === userId);
}

/** Counts the client needs, so registration rows themselves never leave the server. */
function registrationCounts(registrations: any[]) {
  return {
    pending: registrations.filter((r) => r.status === 'pending').length,
    confirmed: registrations.filter((r) => r.status === 'confirmed').length,
    waitlisted: registrations.filter((r) => r.status === 'waitlisted').length,
    interested: registrations.filter((r) => r.status === 'interested').length,
    total: registrations.filter((r) => r.status !== 'cancelled').length,
  };
}

function seatedCount(event: IEventDocument): number {
  return event.registrations.filter((r) => r.status === 'confirmed').length;
}

function hasSeatAvailable(event: IEventDocument): boolean {
  if (!event.maxParticipants) return true;
  return seatedCount(event) < event.maxParticipants;
}

/** True when the event asks a required question, so an organiser must read the answers before granting a seat. */
export function needsApproval(event: any): boolean {
  return !!event.registrationRequired && (event.registrationFields || []).some((f: any) => f.required);
}

/** Status a fresh sign-up earns: interest without registration, pending while answers await review, else a seat or the waitlist. */
export function nextRegistrationStatus(event: any): EventRegistrationStatus {
  if (!event.registrationRequired) return 'interested';
  if (needsApproval(event)) return 'pending';
  return hasSeatAvailable(event) ? 'confirmed' : 'waitlisted';
}

/** Move the longest-waiting person into a seat that just opened up. */
function promoteFromWaitlist(event: IEventDocument): void {
  if (!event.maxParticipants) return;

  const waiting = event.registrations
    .filter((r) => r.status === 'waitlisted')
    .sort((a, b) => (a.registeredAt?.getTime() || 0) - (b.registeredAt?.getTime() || 0));

  for (const next of waiting) {
    if (!hasSeatAvailable(event)) break;
    next.status = 'confirmed';
  }
}

/** Check the answers against the event's own questions, enforcing required ones only for self-registration. */
export function validateResponses(
  event: IEventDocument,
  responses: Record<string, string> | undefined,
  enforceRequired = true
): Record<string, string> {
  const answers: Record<string, string> = {};

  for (const field of event.registrationFields || []) {
    const raw = responses?.[field.key];
    const value = typeof raw === 'string' ? raw.trim() : raw === undefined || raw === null ? '' : String(raw);

    // Each message is keyed by the field, so the client can print it under the input it belongs to.
    if (!value) {
      if (enforceRequired && field.required) {
        const message = `${field.label} is required`;
        throw ApiError.badRequest(message, { [field.key]: [message] });
      }
      continue;
    }

    if (field.type === 'select' && field.options?.length && !field.options.includes(value)) {
      const message = `${field.label} must be one of: ${field.options.join(', ')}`;
      throw ApiError.badRequest(message, { [field.key]: [message] });
    }
    if (field.type === 'number' && Number.isNaN(Number(value))) {
      const message = `${field.label} must be a number`;
      throw ApiError.badRequest(message, { [field.key]: [message] });
    }

    answers[field.key] = value;
  }

  return answers;
}

/** Quote a CSV cell so commas, quotes and newlines survive the round trip. */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

/** Slugify the event title so the download lands with a name the organiser recognises. */
function csvFilename(title: string, kind: string): string {
  const slug = (title || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'event';
  return `${slug}-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
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
      const term = escapeRegex(query.search);
      filter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
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
        .populate('committee', 'name isCurrent')
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

  /** Public event detail, carrying only the requester's own registration so nobody reads another attendee's answers. */
  async getById(id: string, requesterId?: string): Promise<any> {
    const event = await Event.findOne({ _id: id, isDeleted: false })
      .populate('createdBy', 'name avatar')
      .populate('committee', 'name isCurrent')
      .populate('attendance.user', 'name avatar department batch studentId')
      .populate('attendance.verifiedBy', 'name')
      .populate('photos.taggedUsers', 'name avatar');
    if (!event) throw ApiError.notFound('Event not found');

    const mine = requesterId ? findRegistration(event, requesterId) : undefined;
    const plain = attachDerivedStatus(event as any, new Date());

    plain.myRegistration = mine
      ? { status: mine.status, registeredAt: mine.registeredAt, responses: mine.responses || {} }
      : null;

    return plain;
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

  /**
   * Register the current user, seating them or adding them to the waitlist when the event is full.
   */
  async register(
    eventId: string,
    userId: string,
    responses?: Record<string, string>
  ): Promise<{ event: IEventDocument; status: EventRegistrationStatus }> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw ApiError.badRequest('Registration deadline has passed');
    }

    const existing = findRegistration(event, userId);
    if (existing && existing.status !== 'cancelled') {
      throw ApiError.conflict('Already registered for this event');
    }

    const answers = validateResponses(event, responses);

    const status = nextRegistrationStatus(event);

    if (existing) {
      existing.status = status;
      existing.registeredAt = new Date();
      existing.responses = answers;
      existing.updatedBy = undefined;
    } else {
      event.registrations.push({
        user: new mongoose.Types.ObjectId(userId),
        registeredAt: new Date(),
        status,
        responses: answers,
      } as any);
    }

    await event.save();
    return { event, status };
  }

  /** Withdraw the current user's own registration, promoting the first waitlisted person into the seat. */
  async withdrawRegistration(eventId: string, userId: string): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const existing = findRegistration(event, userId);
    if (!existing || existing.status === 'cancelled') {
      throw ApiError.notFound('You are not registered for this event');
    }

    existing.status = 'cancelled';
    promoteFromWaitlist(event);
    await event.save();
    return event;
  }

  /** Registration list for organisers, newest first with unknown-time legacy rows last. */
  async getRegistrations(eventId: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false }).populate(
      'registrations.user',
      'name email phone avatar department batch studentId'
    );
    if (!event) throw ApiError.notFound('Event not found');

    return [...event.registrations].sort(
      (a, b) => (b.registeredAt?.getTime() || 0) - (a.registeredAt?.getTime() || 0)
    );
  }

  /** Add or update one registration on an organiser's behalf. */
  async setRegistration(
    eventId: string,
    userId: string,
    input: { status?: EventRegistrationStatus; note?: string; responses?: Record<string, string> },
    actorId: string
  ): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const existing = findRegistration(event, userId);
    const status = input.status || existing?.status || 'confirmed';

    if (existing) {
      existing.status = status;
      if (input.note !== undefined) existing.note = input.note;
      if (input.responses) existing.responses = validateResponses(event, input.responses, false);
      existing.updatedBy = new mongoose.Types.ObjectId(actorId);
    } else {
      event.registrations.push({
        user: new mongoose.Types.ObjectId(userId),
        registeredAt: new Date(),
        status,
        note: input.note,
        responses: input.responses ? validateResponses(event, input.responses, false) : {},
        updatedBy: new mongoose.Types.ObjectId(actorId),
      } as any);
    }

    await event.save();
    return event;
  }

  /** Money linked to an event, reported as totals so the public page never exposes individual records. */
  async getFinance(eventId: string) {
    const event = await Event.findOne({ _id: eventId, isDeleted: false }).select('_id');
    if (!event) throw ApiError.notFound('Event not found');

    const linked = { event: new mongoose.Types.ObjectId(eventId), isDeleted: false };
    const sum = (field: string) => [{ $group: { _id: null, total: { $sum: field }, count: { $sum: 1 } } }];

    const [budget, income, expense] = await Promise.all([
      Budget.aggregate([{ $match: linked }, ...sum('$totalAmount')]),
      Donation.aggregate([{ $match: { ...linked, paymentStatus: 'completed' } }, ...sum('$amount')]),
      Expense.aggregate([{ $match: linked }, ...sum('$amount')]),
    ]);

    const totals = {
      budget: budget[0]?.total || 0,
      income: income[0]?.total || 0,
      expense: expense[0]?.total || 0,
    };
    const counts = {
      budget: budget[0]?.count || 0,
      income: income[0]?.count || 0,
      expense: expense[0]?.count || 0,
    };

    return {
      ...totals,
      counts,
      net: totals.income - totals.expense,
      // Nothing linked means the UI hides the whole section rather than showing zeros.
      hasData: counts.budget + counts.income + counts.expense > 0,
    };
  }

  /** Registration list as CSV, with one extra column per custom question. */
  async exportRegistrations(eventId: string): Promise<{ filename: string; csv: string }> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false }).populate(
      'registrations.user',
      'name email phone department batch studentId'
    );
    if (!event) throw ApiError.notFound('Event not found');

    const fields = event.registrationFields || [];
    const headers = [
      'Name', 'Email', 'Phone', 'Department', 'Batch', 'Student ID',
      'Status', 'Registered At', ...fields.map((f) => f.label), 'Note',
    ];

    const rows = [...event.registrations]
      .sort((a, b) => (a.registeredAt?.getTime() || 0) - (b.registeredAt?.getTime() || 0))
      .map((r) => {
        const u: any = r.user || {};
        return [
          u.name || '', u.email || '', u.phone || '', u.department || '', u.batch || '', u.studentId || '',
          r.status,
          r.registeredAt.toISOString(),
          ...fields.map((f) => r.responses?.[f.key] || ''),
          r.note || '',
        ];
      });

    return { filename: csvFilename(event.title, 'registrations'), csv: toCsv(headers, rows) };
  }

  /** Attendance list as CSV, so organisers can compare who registered against who turned up. */
  async exportAttendance(eventId: string): Promise<{ filename: string; csv: string }> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false })
      .populate('attendance.user', 'name email phone department batch studentId')
      .populate('attendance.verifiedBy', 'name');
    if (!event) throw ApiError.notFound('Event not found');

    const headers = [
      'Name', 'Email', 'Phone', 'Department', 'Batch', 'Student ID',
      'Status', 'Checked In Via', 'Checked In At', 'Verified By',
    ];

    const rows = [...event.attendance]
      .sort((a, b) => (a.checkedInAt?.getTime() || 0) - (b.checkedInAt?.getTime() || 0))
      .map((a) => {
        const u: any = a.user || {};
        return [
          u.name || '', u.email || '', u.phone || '', u.department || '', u.batch || '', u.studentId || '',
          a.status, a.checkedInVia,
          a.checkedInAt ? a.checkedInAt.toISOString() : '',
          (a.verifiedBy as any)?.name || '',
        ];
      });

    return { filename: csvFilename(event.title, 'attendance'), csv: toCsv(headers, rows) };
  }

  /** Remove a registration row outright, as opposed to cancelling it. */
  async removeRegistration(eventId: string, userId: string): Promise<IEventDocument> {
    const event = await Event.findOne({ _id: eventId, isDeleted: false });
    if (!event) throw ApiError.notFound('Event not found');

    const idx = event.registrations.findIndex((r) => registrantId(r) === userId);
    if (idx === -1) throw ApiError.notFound('Registration not found');

    event.registrations.splice(idx, 1);
    promoteFromWaitlist(event);
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
    if (!event.registrationRequired) {
      throw ApiError.badRequest('QR check-in needs registration to be required for this event');
    }

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
