import { Request, Response } from 'express';
import { donationService } from '../services/donation.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { SiteSettings } from '../models';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { donations, total, page, limit } = await donationService.list(req.query as any);
  ApiResponse.paginated(res, donations, total, page, limit);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const requesterId = req.user ? (req.user._id as any).toString() : undefined;
  const donation = await donationService.getById(req.params.id as string, requesterId);
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
    (req.user._id as any).toString(),
    req.body.revisionNote
  );
  ApiResponse.success(res, donation, `Payment ${req.body.paymentStatus}`);
});

export const myDonations = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const donations = await donationService.myDonations((req.user._id as any).toString());
  ApiResponse.success(res, donations);
});

/** Public endpoint: returns active payment methods (mobile banking numbers) from settings */
export const getPaymentMethods = asyncHandler(async (_req: Request, res: Response) => {
  let settings = await SiteSettings.findOne();
  if (!settings) settings = await SiteSettings.create({});

  const methods: Array<{ provider: string; number: string; type: string }> = [];
  const gw = settings.paymentGateway;
  if (gw?.bkash?.isActive && gw.bkash.number) methods.push({ provider: 'bkash', number: gw.bkash.number, type: gw.bkash.type });
  if (gw?.nagad?.isActive && gw.nagad.number) methods.push({ provider: 'nagad', number: gw.nagad.number, type: gw.nagad.type });
  if (gw?.rocket?.isActive && gw.rocket.number) methods.push({ provider: 'rocket', number: gw.rocket.number, type: gw.rocket.type });

  ApiResponse.success(res, methods);
});

/** Generate printable HTML receipt for a donation */
export const getReceipt = asyncHandler(async (req: Request, res: Response) => {
  const requesterId = req.user ? (req.user._id as any).toString() : undefined;
  const donation = await donationService.getById(req.params.id as string, requesterId);
  if (donation.paymentStatus !== 'completed') {
    throw ApiError.badRequest('Receipt only available for completed donations');
  }

  const donorName = (donation.donor as any)?.name || donation.donorName || 'Anonymous';
  const donorEmail = (donation.donor as any)?.email || donation.donorEmail || '';
  const date = new Date(donation.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Donation Receipt</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; color: #333; }
  .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { margin: 0; color: #2563eb; font-size: 24px; }
  .header p { margin: 5px 0 0; color: #666; }
  .receipt-no { text-align: right; color: #666; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  td { padding: 10px; border-bottom: 1px solid #eee; }
  td:first-child { font-weight: 600; width: 40%; color: #555; }
  .amount { font-size: 24px; font-weight: bold; color: #2563eb; text-align: center; padding: 20px; background: #f0f5ff; border-radius: 8px; margin: 20px 0; }
  .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
  .badge { display: inline-block; padding: 4px 12px; background: #dcfce7; color: #166534; border-radius: 20px; font-size: 12px; font-weight: 600; }
  @media print { body { margin: 0; } }
</style>
</head><body>
  <div class="header">
    <h1>RDSWA</h1>
    <p>Rangpur Divisional Student Welfare Association</p>
    <p>University of Barishal</p>
  </div>
  <div class="receipt-no">Receipt: ${donation.receiptNumber || 'N/A'}</div>
  <h2 style="text-align:center">Donation Receipt</h2>
  <div class="amount">৳${donation.amount.toLocaleString()} BDT</div>
  <table>
    <tr><td>Donor</td><td>${donorName}</td></tr>
    ${donorEmail ? `<tr><td>Email</td><td>${donorEmail}</td></tr>` : ''}
    <tr><td>Date</td><td>${date}</td></tr>
    <tr><td>Type</td><td style="text-transform:capitalize">${donation.type}</td></tr>
    <tr><td>Payment Method</td><td style="text-transform:capitalize">${donation.paymentMethod}</td></tr>
    ${donation.transactionId ? `<tr><td>Transaction ID</td><td>${donation.transactionId}</td></tr>` : ''}
    ${donation.senderNumber ? `<tr><td>Sender Number</td><td>${donation.senderNumber}</td></tr>` : ''}
    <tr><td>Status</td><td><span class="badge">Verified</span></td></tr>
    ${(donation.campaign as any)?.title ? `<tr><td>Campaign</td><td>${(donation.campaign as any).title}</td></tr>` : ''}
    ${donation.note ? `<tr><td>Note</td><td>${donation.note}</td></tr>` : ''}
  </table>
  <div class="footer">
    <p>Thank you for your generous contribution!</p>
    <p>This is a computer-generated receipt. No signature required.</p>
    <p>RDSWA &copy; ${new Date().getFullYear()}</p>
  </div>
</body></html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
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
