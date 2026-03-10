import { Request, Response } from 'express';
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
  const { userId } = req.body;
  await eventService.submitAttendance(req.params.id as string, userId, 'qr', (req.user._id as any).toString());
  ApiResponse.success(res, null, 'Checked in');
});

export const submitAttendance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { userId } = req.body;
  await eventService.submitAttendance(req.params.id as string, userId, 'manual', (req.user._id as any).toString());
  ApiResponse.success(res, null, 'Attendance recorded');
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
