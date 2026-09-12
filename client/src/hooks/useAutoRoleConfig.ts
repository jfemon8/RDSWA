import { useQuery } from '@tanstack/react-query';
import { ADMIN_AUTO_POSITIONS, MODERATOR_AUTO_POSITIONS } from '@rdswa/shared';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export interface AutoRoleConfigShape {
  adminPositions: string[];
  moderatorPositions: string[];
  advisorOnArchivePositions: string[];
}

/** Shown only until the real configuration loads, never as a value to save back. */
export const AUTO_ROLE_CONFIG_FALLBACK: AutoRoleConfigShape = {
  adminPositions: [...ADMIN_AUTO_POSITIONS],
  moderatorPositions: [...MODERATOR_AUTO_POSITIONS],
  advisorOnArchivePositions: [...ADMIN_AUTO_POSITIONS],
};

/**
 * The single reader for the auto-role rules, so every page that shows them shares one cache
 * entry in one shape, two callers normalising the same key differently would hand whichever
 * loaded second a config it cannot parse.
 */
export function useAutoRoleConfig() {
  return useQuery<AutoRoleConfigShape>({
    queryKey: queryKeys.settings.autoRole,
    queryFn: async () => {
      const { data } = await api.get('/settings/auto-role-config');
      const cfg = data.data || {};
      return {
        adminPositions: Array.isArray(cfg.adminPositions) ? cfg.adminPositions : [],
        moderatorPositions: Array.isArray(cfg.moderatorPositions) ? cfg.moderatorPositions : [],
        advisorOnArchivePositions: Array.isArray(cfg.advisorOnArchivePositions) ? cfg.advisorOnArchivePositions : [],
      };
    },
  });
}
