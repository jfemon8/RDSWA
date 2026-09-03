import { SiteSettings } from '../models';
import { ADMIN_AUTO_POSITIONS, MODERATOR_AUTO_POSITIONS } from '@rdswa/shared';

export interface EffectiveAutoRoleConfig {
  /** Positions that auto-grant Admin role in the current committee. */
  adminPositions: string[];
  /** Positions that auto-grant Moderator role in the current committee. */
  moderatorPositions: string[];
  /** Positions that auto-grant the Advisor tag when their committee archives. */
  advisorOnArchivePositions: string[];
  /** Convenience union — all positions that receive any auto-role in current committee. */
  allAutoPositions: string[];
}

/** Hard fallbacks used when SiteSettings.autoRoleConfig is missing entirely. */
const DEFAULT_ADMIN_POSITIONS = ADMIN_AUTO_POSITIONS;
const DEFAULT_MODERATOR_POSITIONS = MODERATOR_AUTO_POSITIONS;
const DEFAULT_ADVISOR_ON_ARCHIVE_POSITIONS = ADMIN_AUTO_POSITIONS;

/** Resolve the auto-role configuration that drives every role transition, honouring an explicitly empty array as disabled and falling back to the shared defaults only when a field is absent. */
export async function getAutoRoleConfig(): Promise<EffectiveAutoRoleConfig> {
  const settings = await SiteSettings.findOne().lean();
  const cfg = (settings as any)?.autoRoleConfig ?? {};

  const adminPositions = Array.isArray(cfg.adminPositions)
    ? cfg.adminPositions
    : DEFAULT_ADMIN_POSITIONS;
  const moderatorPositions = Array.isArray(cfg.moderatorPositions)
    ? cfg.moderatorPositions
    : DEFAULT_MODERATOR_POSITIONS;
  const advisorOnArchivePositions = Array.isArray(cfg.advisorOnArchivePositions)
    ? cfg.advisorOnArchivePositions
    : DEFAULT_ADVISOR_ON_ARCHIVE_POSITIONS;

  return {
    adminPositions,
    moderatorPositions,
    advisorOnArchivePositions,
    allAutoPositions: [...adminPositions, ...moderatorPositions],
  };
}
