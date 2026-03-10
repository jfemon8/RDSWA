import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole } from '@rdswa/shared';

export interface IUserDocument extends Document {
  // Auth
  email: string;
  password: string;
  refreshTokens: string[];

  // Profile — Personal
  name: string;
  nameBn?: string;
  phone?: string;
  avatar?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  bloodGroup?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  isBloodDonor: boolean;
  lastDonationDate?: Date;
  nid?: string;
  presentAddress?: { district?: string; upazila?: string; details?: string };
  permanentAddress?: { district?: string; upazila?: string; details?: string };
  homeDistrict?: string;

  // Profile — Academic
  studentId?: string;
  batch?: number;
  session?: string;
  department?: string;
  faculty?: string;
  admissionYear?: number;
  expectedGraduation?: number;

  // Profile — Professional
  profession?: string;
  jobHistory: Array<{
    company: string;
    position: string;
    startDate: Date;
    endDate?: Date;
    isCurrent: boolean;
  }>;
  businessInfo: Array<{
    businessName: string;
    type: string;
    startDate: Date;
    isCurrent: boolean;
  }>;
  earningSource?: string;
  skills: string[];
  skillEndorsements: Array<{
    skill: string;
    endorsedBy: mongoose.Types.ObjectId;
    endorsedAt: Date;
  }>;

  // Social
  facebook?: string;
  linkedin?: string;
  website?: string;

  // Role & Status
  role: string;
  membershipStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'suspended';
  memberApprovedBy?: mongoose.Types.ObjectId;
  memberApprovedAt?: Date;
  memberRejectionReason?: string;
  suspensionReason?: string;
  suspendedAt?: Date;
  suspendedBy?: mongoose.Types.ObjectId;

  // Moderator tracking
  isModerator: boolean;
  moderatorAssignment?: {
    type: 'auto' | 'manual';
    reason: string;
    assignedBy?: mongoose.Types.ObjectId;
    assignedAt: Date;
  };

  // Notification preferences
  notificationPrefs: {
    email: boolean;
    sms: boolean;
    push: boolean;
    inApp: boolean;
    digestFrequency: 'none' | 'daily' | 'weekly';
    dnd: boolean;
  };

  // Verification
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiry?: Date;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  otp?: string;
  otpExpiry?: Date;

  // Meta
  lastLogin?: Date;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  isAlumni: boolean;

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const addressSchema = new Schema(
  {
    district: String,
    upazila: String,
    details: String,
  },
  { _id: false }
);

const userSchema = new Schema<IUserDocument>(
  {
    // Auth
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    refreshTokens: { type: [String], default: [], select: false },

    // Profile — Personal
    name: { type: String, required: true, trim: true },
    nameBn: { type: String, trim: true },
    phone: { type: String, trim: true },
    avatar: String,
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    isBloodDonor: { type: Boolean, default: false },
    lastDonationDate: Date,
    nid: String,
    presentAddress: addressSchema,
    permanentAddress: addressSchema,
    homeDistrict: String,

    // Profile — Academic
    studentId: String,
    batch: Number,
    session: String,
    department: String,
    faculty: String,
    admissionYear: Number,
    expectedGraduation: Number,

    // Profile — Professional
    profession: String,
    jobHistory: [
      {
        company: String,
        position: String,
        startDate: Date,
        endDate: Date,
        isCurrent: { type: Boolean, default: false },
      },
    ],
    businessInfo: [
      {
        businessName: String,
        type: String,
        startDate: Date,
        isCurrent: { type: Boolean, default: false },
      },
    ],
    earningSource: String,
    skills: [String],
    skillEndorsements: [
      {
        skill: String,
        endorsedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        endorsedAt: Date,
      },
    ],

    // Social
    facebook: String,
    linkedin: String,
    website: String,

    // Role & Status
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    membershipStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected', 'suspended'],
      default: 'none',
    },
    memberApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    memberApprovedAt: Date,
    memberRejectionReason: String,
    suspensionReason: String,
    suspendedAt: Date,
    suspendedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Moderator tracking
    isModerator: { type: Boolean, default: false },
    moderatorAssignment: {
      type: { type: String, enum: ['auto', 'manual'] },
      reason: String,
      assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      assignedAt: Date,
    },

    // Notification preferences
    notificationPrefs: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      digestFrequency: { type: String, enum: ['none', 'daily', 'weekly'], default: 'daily' },
      dnd: { type: Boolean, default: false },
    },

    // Verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpiry: Date,
    passwordResetToken: String,
    passwordResetExpiry: Date,
    otp: String,
    otpExpiry: Date,

    // Meta
    lastLogin: Date,
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: isAlumni
userSchema.virtual('isAlumni').get(function (this: IUserDocument) {
  const hasCurrentJob = this.jobHistory?.some((j) => j.isCurrent);
  const hasCurrentBusiness = this.businessInfo?.some((b) => b.isCurrent);
  return hasCurrentJob || hasCurrentBusiness || false;
});

// Pre-save: hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Method: compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ batch: 1 });
userSchema.index({ department: 1 });
userSchema.index({ membershipStatus: 1 });
userSchema.index({ homeDistrict: 1 });
userSchema.index({ bloodGroup: 1, isBloodDonor: 1 });
userSchema.index({ profession: 1 });
userSchema.index({ 'jobHistory.isCurrent': 1 });
userSchema.index({ isDeleted: 1 });

export const User = mongoose.model<IUserDocument>('User', userSchema);
