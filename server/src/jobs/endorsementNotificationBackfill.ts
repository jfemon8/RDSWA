import { Notification, User } from '../models';

/** Pulls the skill out of the old wording, which is the only place it was recorded. */
function readSkill(message: string): string | null {
  const match = /endorsed your skill:\s*(.+)$/i.exec(message || '');
  return match ? match[1].trim() : null;
}

/**
 * Endorsement notifications used to read "Someone endorsed your skill", losing who did it, so the
 * endorser is recovered from the recipient's own endorsement list by matching skill and timestamp.
 */
export async function backfillEndorsementNotifications(): Promise<void> {
  try {
    const stale = await Notification.find({
      type: 'skill_endorsed',
      'metadata.actorId': { $exists: false },
    }).lean();
    if (stale.length === 0) return;

    const recipientIds = [...new Set(stale.map((n) => String(n.recipient)))];
    const recipients = await User.find({ _id: { $in: recipientIds } })
      .select('skillEndorsements')
      .populate('skillEndorsements.endorsedBy', 'name')
      .lean();

    const bySkill = new Map<string, any[]>();
    for (const user of recipients) {
      bySkill.set(String(user._id), (user as any).skillEndorsements || []);
    }

    let fixed = 0;
    for (const notification of stale) {
      const skill = readSkill(notification.message);
      if (!skill) continue;

      const endorsements = (bySkill.get(String(notification.recipient)) || []).filter(
        (e: any) => e.skill === skill && e.endorsedBy?.name,
      );
      if (endorsements.length === 0) continue;

      // Several people may back the same skill, so the one endorsed nearest this notification wins.
      const sent = new Date(notification.createdAt).getTime();
      const match = endorsements.reduce((best: any, e: any) =>
        Math.abs(new Date(e.endorsedAt).getTime() - sent) <
        Math.abs(new Date(best.endorsedAt).getTime() - sent)
          ? e
          : best,
      );

      const name = match.endorsedBy.name;
      await Notification.updateOne(
        { _id: notification._id },
        {
          $set: {
            message: `${name} endorsed your skill: ${skill}`,
            metadata: { actorId: String(match.endorsedBy._id), actorName: name, skill },
          },
        },
      );
      fixed += 1;
    }

    if (fixed > 0) {
      console.log(`[EndorsementNotifications] Named the endorser on ${fixed} notification(s)`);
    }
  } catch (err) {
    console.error('[EndorsementNotifications] Failed to backfill endorsement notifications:', err);
  }
}
