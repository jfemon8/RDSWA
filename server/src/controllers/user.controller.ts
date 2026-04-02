import { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  // Own profile — always full visibility
  const user = await userService.getById((req.user._id as any).toString(), req.user.role);
  ApiResponse.success(res, user);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await userService.updateProfile((req.user._id as any).toString(), req.body);
  ApiResponse.success(res, user, 'Profile updated');
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  // If viewing own profile, show everything; otherwise apply visibility
  const isSelf = req.user && (req.user._id as any).toString() === id;
  const viewerRole = isSelf ? 'super_admin' : req.user?.role;
  const user = await userService.getById(id, viewerRole);
  ApiResponse.success(res, user);
});

export const adminUpdateUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const user = await userService.adminUpdateUser(id, req.body, req.user);
  ApiResponse.success(res, user, 'User updated');
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { users, total, page, limit } = await userService.listUsers(req.query as any);
  ApiResponse.paginated(res, users, total, page, limit);
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const query = { ...req.query as any, membershipStatus: 'approved' };
  const { users, total, page, limit } = await userService.listUsers(query);
  ApiResponse.paginated(res, users, total, page, limit);
});

export const listBloodDonors = asyncHandler(async (req: Request, res: Response) => {
  const result = await userService.listBloodDonors(req.query as any);
  ApiResponse.paginated(res, result.users, result.total, result.page, result.limit);
});

export const changeRole = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const user = await userService.changeRole(id, req.body.role, req.user);
  ApiResponse.success(res, user, 'Role updated');
});

export const approveMembership = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const user = await userService.approveMembership(id, req.user);
  ApiResponse.success(res, user, 'Membership approved');
});

export const rejectMembership = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = await userService.rejectMembership(id, req.body.reason);
  ApiResponse.success(res, user, 'Membership rejected');
});

export const suspendUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const user = await userService.suspendUser(id, req.body.reason, req.user);
  ApiResponse.success(res, user, 'User suspended');
});

export const unsuspendUser = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const user = await userService.unsuspendUser(id, req.user);
  ApiResponse.success(res, user, 'User reinstated');
});

export const endorseSkill = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const { skill } = req.body;
  if (!skill) throw ApiError.badRequest('Skill is required');
  const user = await userService.endorseSkill(id, skill, (req.user._id as any).toString());
  ApiResponse.success(res, user, 'Skill endorsed');
});

export const removeEndorsement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const id = req.params.id as string;
  const { skill } = req.body;
  if (!skill) throw ApiError.badRequest('Skill is required');
  const user = await userService.removeEndorsement(id, skill, (req.user._id as any).toString());
  ApiResponse.success(res, user, 'Endorsement removed');
});

export const exportDirectory = asyncHandler(async (req: Request, res: Response) => {
  const format = (req.query.format as string) === 'csv' ? 'csv' : 'json';
  const filters = {
    role: req.query.role as string | undefined,
    membershipStatus: req.query.membershipStatus as string | undefined,
    search: req.query.search as string | undefined,
  };
  const result = await userService.exportDirectory(format, filters);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=member-directory.csv');
    res.send(result);
  } else {
    ApiResponse.success(res, result);
  }
});
