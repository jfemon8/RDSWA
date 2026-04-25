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
  const event = await eventService.getById(req.params.id as string);
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
  const event = await eventService.register(req.params.id as string, (req.user._id as any).toString());
  ApiResponse.success(res, event, 'Registered for event');
});

export const checkin = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { userId, method } = req.body;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw ApiError.badRequest('Invalid user ID in QR / form payload');
  }
  const via = method === 'manual' ? 'manual' : 'qr';
  const result = await eventService.submitAttendance(
    req.params.id as string,
    userId,
    via,
    (req.user._id as any).toString()
  );
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
  const { userId } = req.body;
  if (!userId || !mongoose.isValidObjectId(userId)) {
    throw ApiError.badRequest('Invalid user ID');
  }
  const result = await eventService.submitAttendance(
    req.params.id as string,
    userId,
    'manual',
    (req.user._id as any).toString()
  );
  const message =
    result.status === 'duplicate'
      ? 'Already checked in'
      : 'Attendance recorded';
  ApiResponse.success(res, result, message);
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
  const event = await eventService.selfCheckin(req.params.id as string, (req.user._id as any).toString());
  ApiResponse.success(res, event, 'Check-in request submitted. Awaiting moderator approval.');
});

export const bulkAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) throw ApiError.badRequest('userIds array is required');
  const event = await eventService.bulkAttendance(req.params.id as string, userIds, (req.user._id as any).toString());
  ApiResponse.success(res, event, `${userIds.length} users checked in`);
});

export const approveAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const event = await eventService.approveAttendance(req.params.id as string, req.params.userId as string, (req.user._id as any).toString());
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
