import { Donation, IDonationDocument, DonationCampaign, IDonationCampaignDocument } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';

export class DonationService {
  async list(query: { page?: string; limit?: string; type?: string; paymentStatus?: string }) {
    const { page, limit } = parsePagination(query);
    const filter: FilterQuery<IDonationDocument> = { isDeleted: false };

    if (query.type) filter.type = query.type;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate('donor', 'name avatar')
        .populate('campaign', 'title')
        .sort({ createdAt: -1 })
        .skip(getSkip({ page, limit }))
        .limit(limit),
      Donation.countDocuments(filter),
    ]);

    return { donations, total, page, limit };
  }

  async getById(id: string): Promise<IDonationDocument> {
    const donation = await Donation.findOne({ _id: id, isDeleted: false })
      .populate('donor', 'name avatar email')
      .populate('campaign', 'title')
      .populate('paymentVerifiedBy', 'name');
    if (!donation) throw ApiError.notFound('Donation not found');
    return donation;
  }

  async create(data: any, donorId?: string): Promise<IDonationDocument> {
    return Donation.create({ ...data, donor: donorId || undefined });
  }

  async verifyPayment(id: string, status: string, verifiedBy: string): Promise<IDonationDocument> {
    const donation = await Donation.findOne({ _id: id, isDeleted: false });
    if (!donation) throw ApiError.notFound('Donation not found');

    donation.paymentStatus = status as any;
    donation.paymentVerifiedBy = verifiedBy as any;
    donation.paymentVerifiedAt = new Date();
    await donation.save();

    // Update campaign raised amount if completed
    if (status === 'completed' && donation.campaign) {
      await DonationCampaign.findByIdAndUpdate(donation.campaign, {
        $inc: { raisedAmount: donation.amount },
      });
    }

    return donation;
  }

  // Campaigns
  async listCampaigns() {
    return DonationCampaign.find({ isDeleted: false }).sort({ createdAt: -1 });
  }

  async createCampaign(data: any, createdBy: string): Promise<IDonationCampaignDocument> {
    return DonationCampaign.create({ ...data, createdBy });
  }

  async updateCampaign(id: string, data: any): Promise<IDonationCampaignDocument> {
    const campaign = await DonationCampaign.findOne({ _id: id, isDeleted: false });
    if (!campaign) throw ApiError.notFound('Campaign not found');
    Object.assign(campaign, data);
    await campaign.save();
    return campaign;
  }
}

export const donationService = new DonationService();
