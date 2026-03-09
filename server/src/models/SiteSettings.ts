import mongoose, { Schema, Document } from 'mongoose';

export interface ISiteSettingsDocument extends Document {
  siteName: string;
  siteNameBn?: string;
  logo?: string;
  favicon?: string;
  theme: 'light' | 'dark' | 'system';
  primaryColor?: string;
  socialLinks: {
    facebook?: string;
    youtube?: string;
    linkedin?: string;
    twitter?: string;
  };
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  aboutContent?: string;
  missionContent?: string;
  visionContent?: string;
  objectivesContent?: string;
  historyContent?: string;
  universityInfo: {
    overview?: string;
    history?: string;
    campusInfo?: string;
    admissionInfo?: string;
    location?: { lat: number; lng: number };
    contactInfo?: string;
  };
  homePageContent: {
    heroTitle?: string;
    heroSubtitle?: string;
    heroImage?: string;
    introText?: string;
  };
  paymentGateway: {
    bkash?: { number: string; type: string; isActive: boolean };
    nagad?: { number: string; type: string; isActive: boolean };
    rocket?: { number: string; type: string; isActive: boolean };
  };
  membershipCriteria?: Record<string, unknown>;
  votingRules?: Record<string, unknown>;
  updatedBy?: mongoose.Types.ObjectId;
  updatedAt: Date;
}

const siteSettingsSchema = new Schema<ISiteSettingsDocument>(
  {
    siteName: { type: String, default: 'RDSWA' },
    siteNameBn: String,
    logo: String,
    favicon: String,
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
    primaryColor: String,
    socialLinks: {
      facebook: String,
      youtube: String,
      linkedin: String,
      twitter: String,
    },
    contactEmail: String,
    contactPhone: String,
    address: String,
    aboutContent: String,
    missionContent: String,
    visionContent: String,
    objectivesContent: String,
    historyContent: String,
    universityInfo: {
      overview: String,
      history: String,
      campusInfo: String,
      admissionInfo: String,
      location: { lat: Number, lng: Number },
      contactInfo: String,
    },
    homePageContent: {
      heroTitle: String,
      heroSubtitle: String,
      heroImage: String,
      introText: String,
    },
    paymentGateway: {
      bkash: { number: String, type: String, isActive: { type: Boolean, default: false } },
      nagad: { number: String, type: String, isActive: { type: Boolean, default: false } },
      rocket: { number: String, type: String, isActive: { type: Boolean, default: false } },
    },
    membershipCriteria: Schema.Types.Mixed,
    votingRules: Schema.Types.Mixed,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const SiteSettings = mongoose.model<ISiteSettingsDocument>('SiteSettings', siteSettingsSchema);
