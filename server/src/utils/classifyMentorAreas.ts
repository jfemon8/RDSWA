/**
 * Keyword stems per default mentorship area, matched against a mentor's professional profile so the
 * directory can be browsed by area without every mentor having to tag themselves first.
 */
const AREA_KEYWORDS: Record<string, string[]> = {
  'Career Guidance': [
    'hr', 'human resource', 'recruit', 'talent', 'manager', 'management', 'consult',
    'career', 'admin', 'officer', 'executive', 'supervisor', 'coordinator',
  ],
  'Higher Studies': [
    'phd', 'msc', 'mphil', 'postdoc', 'ielts', 'gre', 'toefl', 'scholarship',
    'admission', 'abroad', 'lecturer', 'professor', 'academi', 'universit', 'fellow',
  ],
  'Job Preparation': [
    'bcs', 'bank', 'govt', 'government', 'civil service', 'cadre', 'recruit',
    'interview', 'viva', 'job', 'ngo', 'defence', 'army', 'police',
  ],
  Entrepreneurship: [
    'founder', 'ceo', 'entrepreneur', 'business', 'startup', 'start-up', 'freelanc',
    'e-commerce', 'ecommerce', 'trade', 'owner', 'proprietor', 'merchant', 'shop',
  ],
  Research: [
    'research', 'scientist', 'thesis', 'publication', 'statistic', 'data analys',
    'laborator', 'survey', 'phd', 'analyst',
  ],
  'Skill Development': [
    'develop', 'engineer', 'programm', 'software', 'design', 'graphic', 'marketing',
    'seo', 'web', 'android', 'python', 'javascript', 'trainer', 'training',
    'network', 'database', 'machine learning', 'video edit',
  ],
  'Academic Support': [
    'teacher', 'teaching', 'lecturer', 'professor', 'tutor', 'instructor', 'educat',
    'school', 'college', 'coaching', 'madrasa',
  ],
  'Personal Development': [
    'counsel', 'psycholog', 'motivat', 'leadership', 'communicat', 'public speaking',
    'soft skill', 'social work', 'volunteer', 'wellbeing',
  ],
};

/** The professional fields a classification reads, as one lowercase blob. */
function professionalText(user: {
  profession?: string;
  earningSource?: string;
  skills?: string[];
}): string {
  return [user.profession, user.earningSource, ...(user.skills || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Escape a keyword so a stem containing punctuation cannot alter the pattern. */
function stemPattern(keyword: string): RegExp {
  return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
}

/** The configured areas a mentor's profile places them in, which may be several and never includes an area with no keywords. */
export function classifyMentorAreas(
  user: { profession?: string; earningSource?: string; skills?: string[] },
  areas: string[],
): string[] {
  const text = professionalText(user);
  if (!text.trim()) return [];
  return areas.filter((area) =>
    (AREA_KEYWORDS[area] || []).some((keyword) => stemPattern(keyword).test(text)),
  );
}

/** A mentor's areas: what they chose themselves, plus what their profile implies. */
export function effectiveMentorAreas(
  user: { profession?: string; earningSource?: string; skills?: string[]; mentorAreas?: string[] },
  areas: string[],
): { areas: string[]; derived: string[] } {
  const derived = classifyMentorAreas(user, areas);
  const chosen = user.mentorAreas || [];
  return { areas: [...new Set([...chosen, ...derived])], derived };
}
