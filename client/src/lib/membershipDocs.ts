/**
 * Catalogue of accepted membership document types. These keys are persisted
 * in `Form.attachments[i].name` so they must stay stable. The matching label
 * is rendered in the submission form and the admin review UI.
 *
 * Two groups of documents:
 *   - academicDocs:  proves the applicant's student/alumni status
 *   - identityDocs:  proves the applicant's legal identity
 *
 * The active subset of each group is configured at /admin/system-config →
 * Membership Criteria.
 */

export const ACADEMIC_DOC_TYPES = [
  { key: 'student_id', label: 'Student ID' },
  { key: 'university_id', label: 'University ID' },
  { key: 'admission_payslip', label: 'Admission Payslip' },
] as const;

export const IDENTITY_DOC_TYPES = [
  { key: 'nid', label: 'NID' },
  { key: 'passport', label: 'Passport' },
  { key: 'birth_certificate', label: 'Birth Certificate' },
  { key: 'driving_licence', label: 'Driving Licence' },
] as const;

export type DocTypeKey =
  | (typeof ACADEMIC_DOC_TYPES)[number]['key']
  | (typeof IDENTITY_DOC_TYPES)[number]['key'];

export type MembershipCriteria = {
  academicDocs: { enabled: boolean; accepted: string[] };
  identityDocs: { enabled: boolean; accepted: string[] };
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
  allowedDivisions: string[];
  minBatch: number;
  maxPendingDays: number;
  autoRejectAfterDays: number;
};

export const DEFAULT_MEMBERSHIP_CRITERIA: MembershipCriteria = {
  academicDocs: {
    enabled: true,
    accepted: ACADEMIC_DOC_TYPES.map((d) => d.key),
  },
  identityDocs: {
    enabled: true,
    accepted: IDENTITY_DOC_TYPES.map((d) => d.key),
  },
  requireEmailVerification: false,
  requirePhoneVerification: false,
  allowedDivisions: ['Rangpur'],
  minBatch: 1,
  maxPendingDays: 7,
  autoRejectAfterDays: 30,
};

/**
 * Resolve the user-facing label for a stored attachment whose `name` is
 * either a doc-type key (new format) or a free-form string (legacy format).
 * Falls back to the raw name for backward compatibility with existing forms.
 */
export function getDocLabel(name: string | undefined): string {
  if (!name) return '';
  const all = [...ACADEMIC_DOC_TYPES, ...IDENTITY_DOC_TYPES];
  return all.find((d) => d.key === name)?.label ?? name;
}
