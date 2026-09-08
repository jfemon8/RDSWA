import { Mentorship, Notification } from '../models';
import { getMentorshipConfig } from '../utils/getMentorshipConfig';

/** Nudge mentors about requests that have sat unanswered past the configured window, once per request. */
export async function runMentorshipReminder(): Promise<void> {
  try {
    const { staleRequestDays } = await getMentorshipConfig();
    if (!staleRequestDays) return;

    const staleBefore = new Date(Date.now() - staleRequestDays * 24 * 60 * 60 * 1000);
    const stale = await Mentorship.find({
      status: 'pending',
      requestedAt: { $lt: staleBefore },
    }).populate('mentee', 'name');

    for (const m of stale) {
      // The reminder is keyed to the request so a mentor is only chased once per pairing.
      const existing = await Notification.findOne({
        recipient: m.mentor,
        'metadata.mentorshipId': m._id,
        'metadata.reminderType': 'stale_request',
      });
      if (existing) continue;

      const menteeName = (m.mentee as any)?.name || 'A member';
      await Notification.create({
        recipient: m.mentor,
        type: 'mentorship_request',
        title: 'Mentorship Request Still Waiting',
        message: `${menteeName} requested mentorship ${staleRequestDays}+ days ago and is still waiting for your reply.`,
        link: '/dashboard/mentorship',
        metadata: { mentorshipId: m._id, reminderType: 'stale_request' },
      });
    }
  } catch (err) {
    console.error('Mentorship reminder error:', err);
  }
}

export function startMentorshipReminder(intervalMs = 24 * 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(runMentorshipReminder, intervalMs);
}
