import { committeeService } from '../services/committee.service';

/** One-time reconciliation on server start, run before the role sync because that one reads `isCurrent`. */
export async function syncCommitteeCurrentFlags(): Promise<void> {
  try {
    const changed = await committeeService.syncCurrentFlags();
    if (changed > 0) console.log(`[CommitteeSync] Reconciled ${changed} committee(s) against their end dates`);
  } catch (err) {
    console.error('[CommitteeSync] Failed to reconcile current committee flags:', err);
  }
}
