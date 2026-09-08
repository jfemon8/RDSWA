import { SiteSettings } from '../models';
import { ApiError } from '../utils/ApiError';

interface AcademicInput {
  batch?: number;
  session?: string;
  faculty?: string;
  department?: string;
}

/**
 * Reject academic values that are not in the configured lists, checking only what actually changed so
 * a member whose department was later renamed can still save the rest of their profile.
 */
export async function validateAcademicFields(
  incoming: AcademicInput,
  current: AcademicInput
): Promise<void> {
  const touched = (['batch', 'session', 'faculty', 'department'] as const).filter(
    (key) => incoming[key] !== undefined && incoming[key] !== current[key]
  );
  if (touched.length === 0) return;

  const settings = await SiteSettings.findOne().select('academicConfig').lean();
  const cfg = (settings as any)?.academicConfig;
  if (!cfg) return;

  const faculties: Array<{ name: string; departments?: string[] }> = cfg.faculties || [];

  for (const key of touched) {
    const value = incoming[key];
    if (value === '' || value === null) continue;

    if (key === 'batch') {
      // Batches are stored as ordinals, while the config lists them as labels such as "3rd".
      const batches: string[] = cfg.batches || [];
      if (batches.length && !batches.some((b) => parseInt(b, 10) === value)) {
        throw ApiError.badRequest(`"${value}" is not one of the configured batches`);
      }
    } else if (key === 'session') {
      const sessions: string[] = cfg.sessions || [];
      if (sessions.length && !sessions.includes(value as string)) {
        throw ApiError.badRequest(`"${value}" is not one of the configured sessions`);
      }
    } else if (key === 'faculty') {
      if (faculties.length && !faculties.some((f) => f.name === value)) {
        throw ApiError.badRequest(`"${value}" is not one of the configured faculties`);
      }
    } else if (key === 'department') {
      const all = faculties.flatMap((f) => f.departments || []);
      if (all.length && !all.includes(value as string)) {
        throw ApiError.badRequest(`"${value}" is not one of the configured departments`);
      }
    }
  }
}
