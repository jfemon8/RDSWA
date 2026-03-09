import { Request, Response } from 'express';
import { donationService } from '../services/donation.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { donations, total, page, limit } = await donationService.list(req.query as any);
  ApiResponse.paginated(res, donations, total, page, limit);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const donation = await donationService.getById(req.params.id as string);
  ApiResponse.success(res, donation);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const donorId = req.user ? (req.user._id as any).toString() : undefined;
  const donation = await donationService.create(req.body, donorId);
  ApiResponse.created(res, donation, 'Donation recorded');
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const donation = await donationService.verifyPayment(
    req.params.id as string,
    req.body.paymentStatus,
    (req.user._id as any).toString()
  );
  ApiResponse.success(res, donation, 'Payment verified');
});

export const listCampaigns = asyncHandler(async (_req: Request, res: Response) => {
  const campaigns = await donationService.listCampaigns();
  ApiResponse.success(res, campaigns);
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const campaign = await donationService.createCampaign(req.body, (req.user._id as any).toString());
  ApiResponse.created(res, campaign, 'Campaign created');
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await donationService.updateCampaign(req.params.id as string, req.body);
  ApiResponse.success(res, campaign, 'Campaign updated');
});
