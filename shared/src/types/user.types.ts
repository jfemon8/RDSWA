import { UserRole } from '../constants/roles';

export interface Address {
  district?: string;
  upazila?: string;
  details?: string;
}

export interface JobEntry {
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  isCurrent: boolean;
}

export interface BusinessEntry {
  businessName: string;
  type: string;
  startDate: string;
  isCurrent: boolean;
}

export interface SkillEndorsement {
  skill: string;
  endorsedBy: string;
  endorsedAt: string;
}

export interface NotificationPrefs {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  digestFrequency: 'none' | 'daily' | 'weekly';
  dnd: boolean;
}

export interface ModeratorAssignment {
  type: 'auto' | 'manual';
  reason: string;
  assignedBy?: string;
  assignedAt: string;
}

export type MembershipStatus = 'none' | 'pending' | 'approved' | 'rejected' | 'suspended';
export type Gender = 'male' | 'female' | 'other';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface IUser {
  _id: string;
  email: string;
  name: string;
  nameBn?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  isBloodDonor: boolean;
  lastDonationDate?: string;
  nid?: string;
  presentAddress?: Address;
  permanentAddress?: Address;
  homeDistrict?: string;

  // Academic
  studentId?: string;
  batch?: number;
  session?: string;
  department?: string;
  faculty?: string;
  admissionYear?: number;
  expectedGraduation?: number;

  // Professional
  profession?: string;
  jobHistory: JobEntry[];
  businessInfo: BusinessEntry[];
  earningSource?: string;
  skills: string[];

  // Social
  facebook?: string;
  linkedin?: string;
  website?: string;

  // Role & Status
  role: UserRole;
  membershipStatus: MembershipStatus;
  isModerator: boolean;

  // Meta
  isEmailVerified: boolean;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

/** Public-facing user profile (for non-admin views) */
export type PublicUser = Pick<IUser,
  '_id' | 'name' | 'nameBn' | 'avatar' | 'department' | 'batch' |
  'session' | 'bloodGroup' | 'isBloodDonor' | 'homeDistrict' | 'role'
>;
