import { Request, Response } from 'express';
import { committeeService } from '../services/committee.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const committees = await committeeService.getAll();
  ApiResponse.success(res, committees);
});

export const getCurrent = asyncHandler(async (_req: Request, res: Response) => {
  const committee = await committeeService.getCurrent();
  ApiResponse.success(res, committee);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const committee = await committeeService.getById(req.params.id as string);
  ApiResponse.success(res, committee);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const committee = await committeeService.create(req.body, (req.user._id as any).toString());
  ApiResponse.created(res, committee, 'Committee created');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const committee = await committeeService.update(req.params.id as string, req.body);
  ApiResponse.success(res, committee, 'Committee updated');
});

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  const committee = await committeeService.addMember(req.params.id as string, req.body);
  ApiResponse.success(res, committee, 'Member added to committee');
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const committee = await committeeService.removeMember(
    req.params.id as string,
    req.params.userId as string
  );
  ApiResponse.success(res, committee, 'Member removed from committee');
});

export const archive = asyncHandler(async (req: Request, res: Response) => {
  const committee = await committeeService.archive(req.params.id as string);
  ApiResponse.success(res, committee, 'Committee archived');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await committeeService.delete(req.params.id as string);
  ApiResponse.success(res, null, 'Committee deleted');
});
