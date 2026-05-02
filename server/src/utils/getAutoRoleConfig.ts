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

/**
 * Resolve the effective auto-role configuration from SiteSettings, falling
 * back to the shared-constant defaults when fields are absent.
 *
 * An explicitly-empty array (e.g. `adminPositions: []`) is respected — it
 * means the SuperAdmin has chosen to disable that auto-assignment. Only a
 * missing/undefined field uses the default.
 *
 * Used by committee.service and roleSyncOnStart so that automatic role
 * transitions (committee create / add / remove / archive / startup sync)
 * follow the same rules as the editable settings UI.
 */
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
