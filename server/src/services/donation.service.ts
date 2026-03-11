import { Donation, IDonationDocument, DonationCampaign, IDonationCampaignDocument, Notification } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';

export class DonationService {
  async list(query: { page?: string; limit?: string; type?: string; paymentStatus?: string; donor?: string }) {
    const { page, limit } = parsePagination(query);
    const filter: FilterQuery<IDonationDocument> = { isDeleted: false };

    if (query.type) filter.type = query.type;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.donor) filter.donor = query.donor;

    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate('donor', 'name avatar')
        .populate('campaign', 'title')
        .sort({ createdAt: -1 })
        .skip(getSkip({ page, limit }))
        .limit(limit),
      Donation.countDocuments(filter),
    ]);

    // Respect donation privacy — hide donor info for private donations
    const sanitized = donations.map((d) => {
      const obj = d.toObject();
      if (obj.visibility === 'private') {
        obj.donor = undefined;
        obj.donorName = undefined;
        obj.donorEmail = undefined;
        obj.donorPhone = undefined;
      }
      return obj;
    });

    return { donations: sanitized, total, page, limit };
  }

  async getById(id: string, requesterId?: string): Promise<any> {
    const donation = await Donation.findOne({ _id: id, isDeleted: false })
      .populate('donor', 'name avatar email')
      .populate('campaign', 'title')
      .populate('paymentVerifiedBy', 'name');
    if (!donation) throw ApiError.notFound('Donation not found');

    const obj = donation.toObject();
    // Hide donor info for private donations unless the requester is the donor
    if (obj.visibility === 'private' && obj.donor?._id?.toString() !== requesterId) {
      obj.donor = undefined;
      obj.donorName = undefined;
      obj.donorEmail = undefined;
      obj.donorPhone = undefined;
    }
    return obj;
  }

  async create(data: any, donorId?: string): Promise<IDonationDocument> {
    const donationData: any = { ...data, donor: donorId || undefined };

    // If recurring, set next payment date
    if (data.isRecurring && data.recurringInterval) {
      const now = new Date();
      if (data.recurringInterval === 'monthly') {
        donationData.nextPaymentDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      } else {
        donationData.nextPaymentDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      }
    }

    // Generate receipt number
    const count = await Donation.countDocuments();
    donationData.receiptNumber = `RDSWA-${String(count + 1).padStart(6, '0')}`;

    return Donation.create(donationData);
  }

  async verifyPayment(id: string, status: string, verifiedBy: string, revisionNote?: string): Promise<IDonationDocument> {
    const donation = await Donation.findOne({ _id: id, isDeleted: false });
    if (!donation) throw ApiError.notFound('Donation not found');

    donation.paymentStatus = status as any;
    donation.paymentVerifiedBy = verifiedBy as any;
    donation.paymentVerifiedAt = new Date();

    if (status === 'revision' && revisionNote) {
      donation.revisionNote = revisionNote;
    }

    await donation.save();

    // Update campaign raised amount if completed
    if (status === 'completed' && donation.campaign) {
      await DonationCampaign.findByIdAndUpdate(donation.campaign, {
        $inc: { raisedAmount: donation.amount },
      });
    }

    // Notify the donor
    if (donation.donor) {
      const messages: Record<string, { title: string; message: string }> = {
        completed: { title: 'Payment Verified', message: `Your donation of ৳${donation.amount} has been verified. Thank you!` },
        failed: { title: 'Payment Failed', message: `Your donation of ৳${donation.amount} could not be verified. Please contact admin.` },
        refunded: { title: 'Payment Refunded', message: `Your donation of ৳${donation.amount} has been refunded.` },
        revision: { title: 'Payment Needs Revision', message: revisionNote || `Your donation of ৳${donation.amount} needs revision. Please check and resubmit.` },
      };

      const msg = messages[status];
      if (msg) {
        await Notification.create({
          recipient: donation.donor,
          type: 'system',
          title: msg.title,
          message: msg.message,
          link: '/donations',
        });
      }
    }

    return donation;
  }

  async myDonations(userId: string) {
    return Donation.find({ donor: userId, isDeleted: false })
      .populate('campaign', 'title')
      .sort({ createdAt: -1 });
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
