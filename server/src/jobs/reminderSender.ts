import { Event, Notification } from '../models';
import { notificationService } from '../services/notification.service';

/** Hourly job that sends reminders for events starting within 24 hours. */
export async function runReminderSender(): Promise<void> {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingEvents = await Event.find({
      status: { $nin: ['draft', 'cancelled'] },
      startDate: { $gte: now, $lte: in24h },
      isDeleted: false,
      registrationRequired: true,
    });

    for (const event of upcomingEvents) {
      // Cancelled sign-ups should not be reminded about the event.
      const recipients = event.registrations.filter((r) => r.status !== 'cancelled');
      for (const userId of recipients.map((r) => r.user)) {
        // Check if reminder already sent
        const existing = await Notification.findOne({
          recipient: userId,
          type: 'event_reminder',
          'metadata.eventId': event._id,
        });

        if (!existing) {
          await notificationService.send({
            recipientId: (userId as any)._id || userId,
            type: 'event_reminder',
            title: 'Event Reminder',
            message: `Reminder: "${event.title}" starts tomorrow!`,
            link: `/events/${event._id}`,
            metadata: { eventId: event._id },
          });
        }
      }
    }
  } catch (err) {
    console.error('Reminder sender error:', err);
  }
}

export function startReminderSender(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(runReminderSender, intervalMs);
}
