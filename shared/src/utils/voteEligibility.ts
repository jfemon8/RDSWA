import { UserRole } from '../constants/roles';

export type EligibleVoters = 'all_members' | 'batch_specific' | 'role_specific';

export interface VoteEligibilityRule {
  eligibleVoters?: EligibleVoters;
  eligibleBatches?: number[];
  eligibleRoles?: string[];
}

export interface VoterIdentity {
  batch?: number | null;
  role?: string | null;
}

/** Whether a poll restricted to certain batches or roles admits this voter. */
export function isEligibleVoter(vote: VoteEligibilityRule, voter: VoterIdentity): boolean {
  if (vote.eligibleVoters === 'batch_specific') {
    // A voter with no batch on file cannot match a batch list, so they stay out rather than slipping past the rule.
    return !!voter.batch && (vote.eligibleBatches || []).includes(voter.batch);
  }
  if (vote.eligibleVoters === 'role_specific') {
    if (!voter.role) return false;
    const roles = vote.eligibleRoles || [];
    // SuperAdmin is masked as Admin across the UI and never offered as its own choice, so an Admin poll admits it.
    if (voter.role === UserRole.SUPER_ADMIN && roles.includes(UserRole.ADMIN)) return true;
    return roles.includes(voter.role);
  }
  return true;
}

/** Sentence naming who may vote, used where the restriction has to be visible to voters. */
export function describeEligibility(vote: VoteEligibilityRule, formatBatch: (batch: number) => string): string {
  if (vote.eligibleVoters === 'batch_specific') {
    const batches = (vote.eligibleBatches || []).map(formatBatch);
    return batches.length ? `Only for batch ${batches.join(', ')}` : 'No batch selected — nobody can vote';
  }
  if (vote.eligibleVoters === 'role_specific') {
    const roles = (vote.eligibleRoles || []).map((r) => r.replace(/_/g, ' '));
    return roles.length ? `Only for ${roles.join(', ')}` : 'No role selected — nobody can vote';
  }
  return 'Open to all members';
}
