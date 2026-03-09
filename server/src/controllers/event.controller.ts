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
