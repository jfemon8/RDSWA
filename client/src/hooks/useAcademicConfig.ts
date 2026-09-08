import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export interface AcademicConfig {
  batches: string[];
  sessions: string[];
  faculties: Array<{ name: string; departments: string[] }>;
}

const EMPTY: AcademicConfig = { batches: [], sessions: [], faculties: [] };

/**
 * The single reader for batches, sessions and faculties, so every dropdown shares one cache entry
 * in one shape — two callers normalising the same key differently would hand whichever loaded
 * second a config it cannot parse, leaving its dropdowns silently empty.
 */
export function useAcademicConfig() {
  const query = useQuery<AcademicConfig>({
    queryKey: queryKeys.settings.academic,
    queryFn: async () => {
      const { data } = await api.get('/settings/academic-config');
      const cfg = data.data || {};
      return {
        batches: Array.isArray(cfg.batches) ? cfg.batches : [],
        sessions: Array.isArray(cfg.sessions) ? cfg.sessions : [],
        faculties: Array.isArray(cfg.faculties) ? cfg.faculties : [],
      };
    },
    staleTime: 5 * 60_000,
  });

  const config = query.data ?? EMPTY;
  return {
    ...query,
    config,
    /** Every department across all faculties, which is what a flat department filter needs. */
    departments: config.faculties.flatMap((f) => f.departments || []),
  };
}
