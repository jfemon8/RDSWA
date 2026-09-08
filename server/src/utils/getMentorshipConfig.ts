import { SiteSettings } from '../models';

export interface EffectiveMentorshipConfig {
  /** Areas a request or a mentor profile may name, so both sides draw from one list. */
  areas: string[];
  /** Active mentees one mentor may hold, where 0 disables the cap. */
  maxActiveMentees: number;
  /** Days a request may sit unanswered before the mentor is reminded. */
  staleRequestDays: number;
}

const DEFAULT_AREAS = [
  'Career Guidance', 'Higher Studies', 'Job Preparation', 'Entrepreneurship',
  'Research', 'Skill Development', 'Academic Support', 'Personal Development',
];

/** Resolve the mentorship programme rules, honouring an explicitly empty area list as "no fixed areas". */
export async function getMentorshipConfig(): Promise<EffectiveMentorshipConfig> {
  const settings = await SiteSettings.findOne().lean();
  const cfg = (settings as any)?.mentorshipConfig ?? {};

  return {
    areas: Array.isArray(cfg.areas) ? cfg.areas : DEFAULT_AREAS,
    maxActiveMentees: typeof cfg.maxActiveMentees === 'number' ? cfg.maxActiveMentees : 5,
    staleRequestDays: typeof cfg.staleRequestDays === 'number' ? cfg.staleRequestDays : 7,
  };
}
