import { Request, Response } from 'express';
import { noticeService } from '../services/notice.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { UserRole } from '@rdswa/shared';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const isAdmin = req.user && [UserRole.MODERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role as UserRole);
  const { notices, total, page, limit } = await noticeService.list(req.query as any, !!isAdmin);
  ApiResponse.paginated(res, notices, total, page, limit);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const notice = await noticeService.getById(req.params.id as string);
  ApiResponse.success(res, notice);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const notice = await noticeService.create(req.body, (req.user._id as any).toString());
  ApiResponse.created(res, notice, 'Notice created');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role as UserRole);
  const notice = await noticeService.update(
    req.params.id as string, req.body, (req.user._id as any).toString(), isAdmin
  );
  ApiResponse.success(res, notice, 'Notice updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await noticeService.delete(req.params.id as string);
  ApiResponse.success(res, null, 'Notice deleted');
});

export const archive = asyncHandler(async (req: Request, res: Response) => {
  const notice = await noticeService.archive(req.params.id as string);
  ApiResponse.success(res, notice, 'Notice archived');
});
