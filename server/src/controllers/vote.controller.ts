import { Request, Response } from 'express';
import { voteService } from '../services/vote.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const votes = await voteService.list();
  ApiResponse.success(res, votes);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const vote = await voteService.getById(req.params.id as string);
  ApiResponse.success(res, vote);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const vote = await voteService.create(req.body, (req.user._id as any).toString());
  ApiResponse.created(res, vote, 'Vote created');
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const vote = await voteService.update(req.params.id as string, req.body);
  ApiResponse.success(res, vote, 'Vote updated');
});

export const castVote = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await voteService.castVote(req.params.id as string, req.user, req.body.optionId);
  ApiResponse.success(res, null, 'Vote cast successfully');
});

export const getResults = asyncHandler(async (req: Request, res: Response) => {
  const results = await voteService.getResults(req.params.id as string);
  ApiResponse.success(res, results);
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await voteService.getStats(req.params.id as string);
  ApiResponse.success(res, stats);
});

export const publishResults = asyncHandler(async (req: Request, res: Response) => {
  const vote = await voteService.publishResults(req.params.id as string);
  ApiResponse.success(res, vote, 'Results published');
});

export const closeManually = asyncHandler(async (req: Request, res: Response) => {
  const vote = await voteService.closeManually(req.params.id as string);
  ApiResponse.success(res, vote, 'Vote closed');
});
