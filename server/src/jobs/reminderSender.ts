import { Event, Notification } from '../models';
import { notificationService } from '../services/notification.service';

/**
 * Send reminders for upcoming events (24h before start).
 * Run on a schedule (e.g., every hour).
 */
export async function runReminderSender(): Promise<void> {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcomingEvents = await Event.find({
      status: { $nin: ['draft', 'cancelled'] },
      startDate: { $gte: now, $lte: in24h },
      isDeleted: false,
      registrationRequired: true,
    }).populate('registeredUsers', '_id');

    for (const event of upcomingEvents) {
      for (const userId of event.registeredUsers) {
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
