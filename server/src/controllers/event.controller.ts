import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { eventService } from '../services/event.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '@rdswa/shared';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const isAuth = !!req.user;
  const { events, total, page, limit } = await eventService.list(req.query as any, !isAuth);
  ApiResponse.paginated(res, events, total, page, limit);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const requesterId = req.user ? (req.user._id as any).toString() : undefined;
  const event = await eventService.getById(req.params.id as string, requesterId);
  ApiResponse.success(res, event);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.create(req.body, (req.user._id as any).toString());
  ApiResponse.created(res, event, 'Event created');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventService.update(req.params.id as string, req.body);
  ApiResponse.success(res, event, 'Event updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await eventService.delete(req.params.id as string);
  ApiResponse.success(res, null, 'Event deleted');
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { event, status } = await eventService.register(
    req.params.id as string,
    (req.user._id as any).toString(),
    req.body?.responses
  );
  const message =
    status === 'pending'
      ? 'Submitted — an organiser will review your answers before your QR code is issued'
      : status === 'waitlisted'
        ? 'Event is full — you have been added to the waitlist'
        : status === 'interested'
          ? 'Your interest has been recorded'
          : 'Registered for event';
  ApiResponse.success(res, event, message);
});

export const withdrawRegistration = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.withdrawRegistration(
    req.params.id as string,
    (req.user._id as any).toString()
  );
  ApiResponse.success(res, event, 'Registration withdrawn');
});

export const getFinance = asyncHandler(async (req: Request, res: Response) => {
  const finance = await eventService.getFinance(req.params.id as string);
  ApiResponse.success(res, finance);
});

export const getRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const registrations = await eventService.getRegistrations(req.params.id as string);
  ApiResponse.success(res, registrations);
});

export const setRegistration = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { userId, status, note, responses } = req.body;
  if (!userId || !mongoose.isValidObjectId(userId)) throw ApiError.badRequest('Invalid user ID');

  const event = await eventService.setRegistration(
    req.params.id as string,
    userId,
    { status, note, responses },
    (req.user._id as any).toString()
  );
  ApiResponse.success(res, event, 'Registration saved');
});

export const updateRegistration = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.setRegistration(
    req.params.id as string,
    req.params.userId as string,
    req.body,
    (req.user._id as any).toString()
  );
  ApiResponse.success(res, event, 'Registration updated');
});

export const removeRegistration = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventService.removeRegistration(
    req.params.id as string,
    req.params.userId as string
  );
  ApiResponse.success(res, event, 'Registration removed');
});

/** Stream a CSV so the browser saves it instead of rendering it. */
function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // The BOM makes Excel read Bangla names as UTF-8 rather than mojibake.
  res.send('﻿' + csv);
}

export const exportRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const { filename, csv } = await eventService.exportRegistrations(req.params.id as string);
  sendCsv(res, filename, csv);
});

export const exportAttendance = asyncHandler(async (req: Request, res: Response) => {
  const { filename, csv } = await eventService.exportAttendance(req.params.id as string);
  sendCsv(res, filename, csv);
});

export const checkin = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { userId, method, checkedInAt } = req.body;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw ApiError.badRequest('Invalid user ID in QR / form payload');
  }
  const via = method === 'manual' ? 'manual' : 'qr';
  const result = await eventService.submitAttendance({
    eventId: req.params.id as string,
    userId,
    via,
    verifiedBy: (req.user._id as any).toString(),
    actorRole: req.user.role,
    checkedInAt,
  });
  // 200 with status='duplicate' is intentional — the scanner UI uses it to
  // render a warning ("already checked in: Name") instead of a hard error.
  const message =
    result.status === 'duplicate'
      ? 'Already checked in'
      : 'Checked in successfully';
  ApiResponse.success(res, result, message);
});

export const submitAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { userId, checkedInAt } = req.body;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw ApiError.badRequest('Invalid user ID');
  }
  const result = await eventService.submitAttendance({
    eventId: req.params.id as string,
    userId,
    via: 'manual',
    verifiedBy: (req.user._id as any).toString(),
    actorRole: req.user.role,
    checkedInAt,
  });
  const message =
    result.status === 'duplicate'
      ? 'Already checked in'
      : 'Attendance recorded';
  ApiResponse.success(res, result, message);
});

/** Only a SuperAdmin moderates a review they did not write, which the service checks against the author. */
function canModerateFeedback(role?: string): boolean {
  return role === UserRole.SUPER_ADMIN;
}

export const getFeedback = asyncHandler(async (req: Request, res: Response) => {
  const result = await eventService.getFeedback(req.params.id as string);
  ApiResponse.success(res, result);
});

export const updateFeedback = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await eventService.updateFeedback(
    req.params.id as string,
    req.params.feedbackId as string,
    (req.user._id as any).toString(),
    canModerateFeedback(req.user.role),
    { rating: req.body.rating, comment: req.body.comment },
  );
  ApiResponse.success(res, result, 'Feedback updated');
});

export const deleteFeedback = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await eventService.deleteFeedback(
    req.params.id as string,
    req.params.feedbackId as string,
    (req.user._id as any).toString(),
    canModerateFeedback(req.user.role),
  );
  ApiResponse.success(res, result, 'Feedback removed');
});

export const submitFeedback = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await eventService.submitFeedback(
    req.params.id as string,
    (req.user._id as any).toString(),
    req.body.rating,
    req.body.comment
  );
  ApiResponse.success(res, null, 'Feedback submitted');
});

export const getAttendance = asyncHandler(async (req: Request, res: Response) => {
  const attendance = await eventService.getAttendance(req.params.id as string);
  ApiResponse.success(res, attendance);
});

export const myAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const records = await eventService.getMyAttendance((req.user._id as any).toString());
  ApiResponse.success(res, records);
});

export const selfCheckin = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.selfCheckin(
    req.params.id as string,
    (req.user._id as any).toString(),
    req.body?.checkedInAt
  );
  ApiResponse.success(res, event, 'Check-in request submitted. Awaiting moderator approval.');
});

export const bulkAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { userIds, checkedInAt } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) throw ApiError.badRequest('userIds array is required');
  const event = await eventService.bulkAttendance({
    eventId: req.params.id as string,
    userIds,
    verifiedBy: (req.user._id as any).toString(),
    actorRole: req.user.role,
    checkedInAt,
  });
  ApiResponse.success(res, event, `${userIds.length} users checked in`);
});

export const approveAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.approveAttendance(
    req.params.id as string,
    req.params.userId as string,
    (req.user._id as any).toString(),
    req.user.role
  );
  ApiResponse.success(res, event, 'Attendance approved');
});

export const rejectAttendance = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventService.removeAttendance(req.params.id as string, req.params.userId as string);
  ApiResponse.success(res, event, 'Attendance rejected');
});

export const removeAttendance = asyncHandler(async (req: Request, res: Response) => {
  const event = await eventService.removeAttendance(req.params.id as string, req.params.userId as string);
  ApiResponse.success(res, event, 'Attendance record removed');
});

export const addReport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.addReport(
    req.params.id as string,
    req.body,
    (req.user._id as any).toString()
  );
  ApiResponse.success(res, event, 'Report uploaded');
});

export const removeReport = asyncHandler(async (req: Request, res: Response) => {
  const reportIndex = parseInt(req.params.reportIndex as string, 10);
  const event = await eventService.removeReport(req.params.id as string, reportIndex);
  ApiResponse.success(res, event, 'Report removed');
});

export const generateQrCode = asyncHandler(async (req: Request, res: Response) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const qrCode = await eventService.generateQrCode(req.params.id as string, baseUrl);
  ApiResponse.success(res, { qrCode }, 'QR code generated');
});

export const addPhoto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.addPhoto(
    req.params.id as string,
    req.body,
    (req.user._id as any).toString()
  );
  ApiResponse.success(res, event, 'Photo added');
});

export const removePhoto = asyncHandler(async (req: Request, res: Response) => {
  const photoIndex = parseInt(req.params.photoIndex as string, 10);
  const event = await eventService.removePhoto(req.params.id as string, photoIndex);
  ApiResponse.success(res, event, 'Photo removed');
});

export const tagPhoto = asyncHandler(async (req: Request, res: Response) => {
  const photoIndex = parseInt(req.params.photoIndex as string, 10);
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) throw ApiError.badRequest('userIds array required');
  const event = await eventService.tagUsersOnPhoto(req.params.id as string, photoIndex, userIds);
  ApiResponse.success(res, event, 'Users tagged');
});

export const untagPhoto = asyncHandler(async (req: Request, res: Response) => {
  const photoIndex = parseInt(req.params.photoIndex as string, 10);
  const { userId } = req.body;
  if (!userId) throw ApiError.badRequest('userId required');
  const event = await eventService.untagUserFromPhoto(req.params.id as string, photoIndex, userId);
  ApiResponse.success(res, event, 'User untagged');
});
