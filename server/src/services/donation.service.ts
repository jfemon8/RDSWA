import { Donation, IDonationDocument, DonationCampaign, IDonationCampaignDocument, Notification } from '../models';
import { ApiError } from '../utils/ApiError';
import { parsePagination, getSkip } from '../utils/pagination';
import { FilterQuery } from 'mongoose';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';

/** What a donation currently adds to its campaign total, which only completed donations do. */
export type CampaignContribution = { campaign: string; amount: number } | null;

export function contributionOf(donation: {
  campaign?: any;
  amount?: number;
  paymentStatus?: string;
}): CampaignContribution {
  if (!donation.campaign || donation.paymentStatus !== 'completed') return null;
  return { campaign: donation.campaign.toString(), amount: donation.amount || 0 };
}

/**
 * The `raisedAmount` increments that move a campaign from one contribution state to another.
 *
 * Kept pure so create, verify, edit and delete can all be reasoned about and tested as one rule.
 */
export function campaignDeltas(
  before: CampaignContribution,
  after: CampaignContribution
): Array<{ campaign: string; inc: number }> {
  if (!before && !after) return [];

  if (before && after && before.campaign === after.campaign) {
    const inc = after.amount - before.amount;
    return inc === 0 ? [] : [{ campaign: after.campaign, inc }];
  }

  const deltas: Array<{ campaign: string; inc: number }> = [];
  if (before) deltas.push({ campaign: before.campaign, inc: -before.amount });
  if (after) deltas.push({ campaign: after.campaign, inc: after.amount });
  return deltas;
}

/**
 * Apply the campaign-total change for a donation transition.
 *
 * Every create, verify, edit and delete routes through here, so a completed donation can never leave a stale total behind.
 */
async function syncCampaignTotals(before: CampaignContribution, after: CampaignContribution): Promise<void> {
  for (const { campaign, inc } of campaignDeltas(before, after)) {
    await DonationCampaign.findByIdAndUpdate(campaign, { $inc: { raisedAmount: inc } });
  }
}

function isAdminOrAbove(role?: string): boolean {
  if (!role) return false;
  return ROLE_HIERARCHY.indexOf(role as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.ADMIN);
}

/** Fields only an Admin+ may set directly, since they decide attribution and money state. */
const PRIVILEGED_FIELDS = ['donor', 'paymentStatus'] as const;

export class DonationService {
  async list(query: { page?: string; limit?: string; type?: string; paymentStatus?: string; donor?: string }, requesterRole?: string) {
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

    // Respect donation privacy — hide donor info for private donations (skip for moderator+)
    const isPrivileged = requesterRole && ROLE_HIERARCHY.indexOf(requesterRole as UserRole) >= ROLE_HIERARCHY.indexOf(UserRole.MODERATOR);
    const sanitized = donations.map((d) => {
      const obj = d.toObject();
      if (obj.visibility === 'private' && !isPrivileged) {
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
    const donorId = obj.donor?._id?.toString();
    const isDonor = requesterId && donorId && donorId === requesterId;
    if (obj.visibility === 'private' && !isDonor) {
      obj.donor = undefined;
      obj.donorName = undefined;
      obj.donorEmail = undefined;
      obj.donorPhone = undefined;
    }
    return obj;
  }

  /**
   * Next receipt number, derived from the highest one already issued.
   *
   * The previous `countDocuments()` approach reused numbers once a donation was soft-deleted, because the count shrank while the issued numbers did not.
   */
  private async nextReceiptNumber(): Promise<string> {
    const latest = await Donation.findOne({ receiptNumber: /^RDSWA-\d+$/ })
      .sort({ receiptNumber: -1 })
      .select('receiptNumber')
      .lean();

    const highest = latest?.receiptNumber ? parseInt(latest.receiptNumber.slice(6), 10) : 0;
    return `RDSWA-${String((Number.isNaN(highest) ? 0 : highest) + 1).padStart(6, '0')}`;
  }

  /**
   * Record a donation.
   *
   * `donor` and `paymentStatus` are honoured only for an Admin+, so a public submission can never attribute itself to someone else or mark itself paid.
   */
  async create(
    data: any,
    options: { donorId?: string; actorRole?: string } = {}
  ): Promise<IDonationDocument> {
    const privileged = isAdminOrAbove(options.actorRole);
    const donationData: any = { ...data };
    for (const field of PRIVILEGED_FIELDS) delete donationData[field];

    // An admin names the donor explicitly, sending '' for someone with no account.
    if (privileged && data.donor !== undefined) {
      donationData.donor = data.donor || undefined;
    } else {
      donationData.donor = options.donorId || undefined;
    }

    if (privileged && data.paymentStatus) {
      donationData.paymentStatus = data.paymentStatus;
      if (data.paymentStatus === 'completed' && options.donorId) {
        donationData.paymentVerifiedBy = options.donorId;
        donationData.paymentVerifiedAt = new Date();
      }
    }

    // An omitted date means the donation happened now.
    donationData.donationDate = data.donationDate ? new Date(data.donationDate) : new Date();

    // An empty campaign means "no campaign", which would fail the ObjectId cast.
    if (!donationData.campaign) donationData.campaign = undefined;

    // If recurring, set next payment date
    if (data.isRecurring && data.recurringInterval) {
      const now = new Date();
      if (data.recurringInterval === 'monthly') {
        donationData.nextPaymentDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      } else {
        donationData.nextPaymentDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      }
    }

    donationData.receiptNumber = await this.nextReceiptNumber();

    const donation = await Donation.create(donationData);
    await syncCampaignTotals(null, contributionOf(donation));
    return donation;
  }

  /**
   * Edit any field of an existing donation, adjusting the campaign total for whatever changed.
   */
  async update(id: string, data: any, options: { actorRole?: string } = {}): Promise<IDonationDocument> {
    const donation = await Donation.findOne({ _id: id, isDeleted: false });
    if (!donation) throw ApiError.notFound('Donation not found');

    const before = contributionOf(donation);
    const privileged = isAdminOrAbove(options.actorRole);

    const updates: any = { ...data };
    for (const field of PRIVILEGED_FIELDS) delete updates[field];

    if (privileged && data.donor !== undefined) {
      updates.donor = data.donor || undefined;
    }
    if (privileged && data.paymentStatus) {
      updates.paymentStatus = data.paymentStatus;
    }
    if (data.donationDate) {
      updates.donationDate = new Date(data.donationDate);
    }
    // An empty campaign means "no campaign", which would fail the ObjectId cast.
    if (data.campaign !== undefined && !data.campaign) {
      updates.campaign = undefined;
    }

    Object.assign(donation, updates);
    await donation.save();

    await syncCampaignTotals(before, contributionOf(donation));
    return donation;
  }

  /** Soft-delete a donation, releasing whatever it contributed to its campaign total. */
  async remove(id: string): Promise<IDonationDocument> {
    const donation = await Donation.findOne({ _id: id, isDeleted: false });
    if (!donation) throw ApiError.notFound('Donation not found');

    const before = contributionOf(donation);
    donation.isDeleted = true;
    await donation.save();

    await syncCampaignTotals(before, null);
    return donation;
  }

  async verifyPayment(id: string, status: string, verifiedBy: string, revisionNote?: string): Promise<IDonationDocument> {
    const donation = await Donation.findOne({ _id: id, isDeleted: false });
    if (!donation) throw ApiError.notFound('Donation not found');

    const before = contributionOf(donation);

    donation.paymentStatus = status as any;
    donation.paymentVerifiedBy = verifiedBy as any;
    donation.paymentVerifiedAt = new Date();

    if (status === 'revision' && revisionNote) {
      donation.revisionNote = revisionNote;
    }

    await donation.save();

    await syncCampaignTotals(before, contributionOf(donation));

    // Notify the donor
    if (donation.donor) {
      const messages: Record<string, { title: string; message: string }> = {
        completed: { title: 'Payment Verified', message: `Your donation of BDT ${donation.amount} has been verified. Thank you!` },
        failed: { title: 'Payment Failed', message: `Your donation of BDT ${donation.amount} could not be verified. Please contact admin.` },
        refunded: { title: 'Payment Refunded', message: `Your donation of BDT ${donation.amount} has been refunded.` },
        revision: { title: 'Payment Needs Revision', message: revisionNote || `Your donation of BDT ${donation.amount} needs revision. Please check and resubmit.` },
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
