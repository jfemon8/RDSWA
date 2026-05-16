/**
 * One-off seed for the Barishal University Cut-off Mark (Session 2024-25)
 * — Social Sciences + Business Studies faculty rows.
 *
 * The other faculties were inserted manually via the admin UI; this script
 * just covers the bottom half of the cut-off chart so we don't retype 30
 * (department × unit) entries.
 *
 * Behavior:
 *   - Auto-detects faculty names from SiteSettings.academicConfig so the
 *     stored strings stay consistent with the rest of the platform (e.g.,
 *     "Faculty of Social Science" vs "Social Sciences"). Falls back to the
 *     image's plain-English names if no match is found.
 *   - Uses bulkWrite with upserts keyed on (session, faculty, department,
 *     unit), so re-running the script is safe — existing rows are updated
 *     in place rather than duplicated.
 *   - Empty cells in the source image stay `undefined` (Sociology B-unit
 *     1st-position has no Score in the chart, for example).
 *
 * Run with:
 *   npm run seed:cutoff-2024-social-business --workspace=server
 */

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { AdmissionCutoff, SiteSettings, User } from '../models';
import type { AdmissionUnit } from '../models';

const SESSION = '2024-25';

type UnitData = {
  firstMerit?: number;
  firstScore?: number;
  lastMerit?: number;
  lastScore?: number;
};

interface DeptInput {
  department: string;
  dataSource: string;
  units: Partial<Record<AdmissionUnit, UnitData>>;
}

const SOCIAL_SCIENCES: DeptInput[] = [
  {
    department: 'Sociology',
    dataSource: 'Mehedi',
    units: {
      A: { firstMerit: 11317, firstScore: 52.50, lastMerit: 11693, lastScore: 52.00 },
      // Source chart leaves B 1st-position Score blank — keep it undefined.
      B: { firstMerit: 379, lastMerit: 3222, lastScore: 56.75 },
      C: { firstMerit: 2399, firstScore: 62.75, lastMerit: 3300, lastScore: 59.50 },
    },
  },
  {
    department: 'Economics',
    dataSource: 'Shanto',
    units: {
      A: { firstMerit: 3683, firstScore: 59.75, lastMerit: 10805, lastScore: 52.50 },
      B: { firstMerit: 408, firstScore: 67.00, lastMerit: 1824, lastScore: 60.25 },
      C: { firstMerit: 1930, firstScore: 64.50, lastMerit: 2661, lastScore: 61.75 },
    },
  },
  {
    department: 'Political Science',
    dataSource: 'Naimur',
    units: {
      A: { firstMerit: 10832, firstScore: 53.00, lastMerit: 11796, lastScore: 52.00 },
      B: { firstMerit: 556, firstScore: 65.75, lastMerit: 2352, lastScore: 58.75 },
      C: { firstMerit: 2238, firstScore: 67.00, lastMerit: 2657, lastScore: 61.75 },
    },
  },
  {
    department: 'Public Administration',
    dataSource: 'Sohan',
    units: {
      A: { firstMerit: 6897, firstScore: 56.00, lastMerit: 11387, lastScore: 51.00 },
      B: { firstMerit: 1286, firstScore: 62.00, lastMerit: 3405, lastScore: 56.50 },
      C: { firstMerit: 500, firstScore: 72.50, lastMerit: 3291, lastScore: 64.00 },
    },
  },
  {
    department: 'Mass Communication & Journalism',
    dataSource: 'Sadia',
    units: {
      A: { firstMerit: 8454, firstScore: 54.50, lastMerit: 12700, lastScore: 51.25 },
      B: { firstMerit: 1114, firstScore: 61.75, lastMerit: 3845, lastScore: 55.50 },
      C: { firstMerit: 2746, firstScore: 61.50, lastMerit: 2901, lastScore: 60.00 },
    },
  },
  {
    department: 'Social Work',
    dataSource: 'Junaid',
    units: {
      A: { firstMerit: 13562, firstScore: 50.50, lastMerit: 13569, lastScore: 50.50 },
      B: { firstMerit: 1092, firstScore: 63.00, lastMerit: 3734, lastScore: 55.75 },
      C: { firstMerit: 2887, firstScore: 62.00, lastMerit: 2926, lastScore: 61.75 },
    },
  },
];

const BUSINESS_STUDIES: DeptInput[] = [
  {
    department: 'Finance & Banking',
    dataSource: 'Asif',
    units: {
      A: { firstMerit: 8903, firstScore: 56.00, lastMerit: 11120, lastScore: 52.25 },
      B: { firstMerit: 2529, firstScore: 58.50, lastMerit: 3531, lastScore: 56.25 },
      C: { firstMerit: 541, firstScore: 72.25, lastMerit: 1909, lastScore: 64.50 },
    },
  },
  {
    department: 'Marketing',
    dataSource: 'Sobuj',
    units: {
      A: { firstMerit: 10765, firstScore: 53.50, lastMerit: 12567, lastScore: 51.25 },
      B: { firstMerit: 2445, firstScore: 58.50, lastMerit: 2987, lastScore: 57.25 },
      C: { firstMerit: 1149, firstScore: 67.25, lastMerit: 2572, lastScore: 62.25 },
    },
  },
  {
    department: 'Accounting & Information Systems',
    dataSource: 'Sumaiya',
    units: {
      A: { firstMerit: 9603, firstScore: 53.50, lastMerit: 10924, lastScore: 52.50 },
      B: { firstMerit: 1858, firstScore: 60.00, lastMerit: 3431, lastScore: 56.25 },
      C: { firstMerit: 130, firstScore: 78.75, lastMerit: 1329, lastScore: 68.25 },
    },
  },
  {
    department: 'Management',
    dataSource: 'Abir',
    units: {
      A: { firstMerit: 9345, firstScore: 53.75, lastMerit: 11486, lastScore: 52.00 },
      B: { firstMerit: 2712, firstScore: 58.00, lastMerit: 3628, lastScore: 56.00 },
      C: { firstMerit: 157, firstScore: 75.50, lastMerit: 2325, lastScore: 63.00 },
    },
  },
];

/**
 * Match a faculty by keyword against the live academicConfig. Picks the
 * first faculty whose name contains the keyword (case-insensitive). Falls
 * back to a sensible default if academicConfig is missing or doesn't list
 * the faculty yet — the cut-off model only stores strings, so an unmatched
 * faculty still inserts cleanly; it just won't appear under the Faculty
 * dropdown when an admin edits the row.
 */
function findFaculty(facultiesInConfig: Array<{ name: string }>, keyword: string, fallback: string): string {
  const re = new RegExp(keyword, 'i');
  const match = facultiesInConfig.find((f) => re.test(f.name));
  if (match) return match.name;
  console.warn(`[seed-cutoff] No faculty matching /${keyword}/i found in academicConfig; using fallback "${fallback}".`);
  return fallback;
}

async function main() {
  console.log('[seed-cutoff] connecting to database...');
  await connectDB();
  console.log(`[seed-cutoff] seeding cut-off rows for session ${SESSION}...`);

  try {
    // Find an admin user to set as createdBy (required by the schema).
    const creator = await User.findOne({ role: { $in: ['super_admin', 'admin'] } })
      .select('_id email role')
      .lean();
    if (!creator) {
      throw new Error('No admin/super_admin user found — cannot set createdBy. Create one before running this seed.');
    }
    console.log(`[seed-cutoff] using createdBy = ${creator.email} (${creator.role})`);

    // Pull academicConfig once for faculty-name matching.
    const settings = await SiteSettings.findOne().select('academicConfig').lean();
    const facultiesInConfig: Array<{ name: string }> = settings?.academicConfig?.faculties || [];
    const socialFaculty = findFaculty(facultiesInConfig, 'social', 'Faculty of Social Science');
    const businessFaculty = findFaculty(facultiesInConfig, 'business', 'Faculty of Business Studies');
    console.log(`[seed-cutoff] Social Sciences faculty → "${socialFaculty}"`);
    console.log(`[seed-cutoff] Business Studies faculty → "${businessFaculty}"`);

    // Flatten the structured data into one bulkWrite op per (session,
    // faculty, department, unit). Upsert by the unique compound key so
    // re-runs update in place instead of erroring on duplicate.
    type BulkOp = Parameters<typeof AdmissionCutoff.bulkWrite>[0][number];
    const ops: BulkOp[] = [];
    const queue = (faculty: string, depts: DeptInput[]) => {
      for (const dept of depts) {
        for (const [unit, data] of Object.entries(dept.units)) {
          if (!data) continue;
          const filter = {
            session: SESSION,
            faculty,
            department: dept.department,
            unit: unit as AdmissionUnit,
            isDeleted: false,
          };
          const update = {
            $set: {
              firstPositionMerit: data.firstMerit,
              firstPositionScore: data.firstScore,
              lastPositionMerit: data.lastMerit,
              lastPositionScore: data.lastScore,
              dataSource: dept.dataSource,
            },
            $setOnInsert: {
              session: SESSION,
              faculty,
              department: dept.department,
              unit: unit as AdmissionUnit,
              isDeleted: false,
              createdBy: creator._id,
              sortOrder: 0,
            },
          };
          ops.push({ updateOne: { filter, update, upsert: true } });
        }
      }
    };
    queue(socialFaculty, SOCIAL_SCIENCES);
    queue(businessFaculty, BUSINESS_STUDIES);

    console.log(`[seed-cutoff] queued ${ops.length} upserts`);
    const result = await AdmissionCutoff.bulkWrite(ops, { ordered: false });
    console.log('\n[seed-cutoff] complete');
    console.log('─────────────────────────────────────────────');
    console.log(`  matched:  ${result.matchedCount}`);
    console.log(`  modified: ${result.modifiedCount}`);
    console.log(`  upserted: ${result.upsertedCount}`);
    console.log('─────────────────────────────────────────────');
  } catch (err) {
    console.error('[seed-cutoff] failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('[seed-cutoff] disconnected');
  }
}

main();
