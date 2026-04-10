import { Donation, Notification } from '../models';

/**
 * Send reminders for:
 * 1. Pending donations older than 48h (overdue)
 * 2. Recurring donations with nextPaymentDate <= now
 *
 * Run on a schedule (e.g., every 6 hours).
 */
export async function runPaymentReminder(): Promise<void> {
  try {
    const now = new Date();

    // 1. Overdue pending payments (submitted > 48h ago, still pending)
    const overdueThreshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const overdueDonations = await Donation.find({
      paymentStatus: 'pending',
      isDeleted: false,
      createdAt: { $lte: overdueThreshold },
      donor: { $exists: true },
    }).select('donor amount paymentMethod receiptNumber');

    for (const donation of overdueDonations) {
      if (!donation.donor) continue;

      // Check if reminder already sent
      const existing = await Notification.findOne({
        recipient: donation.donor,
        type: 'system',
        'metadata.donationId': donation._id,
        'metadata.reminderType': 'overdue',
      });

      if (!existing) {
        await Notification.create({
          recipient: donation.donor,
          type: 'system',
          title: 'Payment Pending',
          message: `Your donation of BDT ${donation.amount} (${donation.receiptNumber || ''}) is still pending verification. If you've already paid, please ensure the transaction details are correct.`,
          link: '/donations',
          metadata: { donationId: donation._id, reminderType: 'overdue' },
        });
      }
    }

    // 2. Recurring donation reminders
    const dueRecurring = await Donation.find({
      isRecurring: true,
      isDeleted: false,
      paymentStatus: 'completed',
      nextPaymentDate: { $lte: now },
      donor: { $exists: true },
    }).select('donor amount type recurringInterval nextPaymentDate');

    for (const donation of dueRecurring) {
      if (!donation.donor) continue;

      const existing = await Notification.findOne({
        recipient: donation.donor,
        type: 'system',
        'metadata.donationId': donation._id,
        'metadata.reminderType': 'recurring',
        createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }, // Don't resend within 7 days
      });

      if (!existing) {
        await Notification.create({
          recipient: donation.donor,
          type: 'system',
          title: 'Recurring Donation Due',
          message: `Your ${donation.recurringInterval} donation of BDT ${donation.amount} is due. Please submit your payment.`,
          link: '/donations',
          metadata: { donationId: donation._id, reminderType: 'recurring' },
        });

        // Advance nextPaymentDate
        const next = new Date(donation.nextPaymentDate!);
        if (donation.recurringInterval === 'monthly') {
          next.setMonth(next.getMonth() + 1);
        } else {
          next.setFullYear(next.getFullYear() + 1);
        }
        donation.nextPaymentDate = next;
        await donation.save();
      }
    }
  } catch (err) {
    console.error('Payment reminder error:', err);
  }
}

export function startPaymentReminder(intervalMs = 6 * 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(runPaymentReminder, intervalMs);
}
