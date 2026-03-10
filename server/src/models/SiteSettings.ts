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
  foundedYear: number;
  homePageContent: {
    heroTitle?: string;
    heroTitleGradient?: string;
    heroBadgeText?: string;
    heroSubtitle?: string;
    heroImage?: string;
    heroTagline?: string;
    rotatingWords?: string[];
    introText?: string;
    featuresHeading?: string;
    featuresSubheading?: string;
    features?: Array<{ title: string; description: string }>;
    servicesHeading?: string;
    services?: Array<{ title: string; description: string; link: string }>;
    ctaTitle?: string;
    ctaButtonText?: string;
  };
  faq: Array<{ question: string; answer: string }>;
  privacyPolicy: Array<{ title: string; content: string }>;
  termsConditions: Array<{ title: string; content: string }>;
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
    foundedYear: { type: Number, default: 2021 },
    homePageContent: {
      heroTitle: { type: String, default: 'Rangpur Divisional Student' },
      heroTitleGradient: { type: String, default: 'Welfare Association' },
      heroBadgeText: { type: String, default: 'Welcome to RDSWA' },
      heroSubtitle: { type: String, default: 'Connecting students from Rangpur Division at University of Barishal.' },
      heroImage: String,
      heroTagline: { type: String, default: 'Building' },
      rotatingWords: { type: [String], default: ['Community', 'Friendships', 'Success', 'Unity', 'Future'] },
      introText: { type: String, default: 'Become a part of the largest Rangpur Division student community at University of Barishal.' },
      featuresHeading: { type: String, default: 'What We Offer' },
      featuresSubheading: { type: String, default: 'A comprehensive platform for Rangpur Division students to connect, grow, and support each other.' },
      features: {
        type: [{ title: { type: String, required: true }, description: { type: String, required: true } }],
        default: [
          { title: 'Community', description: 'Connect with students from your district and build lasting relationships.' },
          { title: 'Events', description: 'Participate in cultural events, workshops, and social gatherings.' },
          { title: 'Notices', description: 'Stay updated with important announcements and university news.' },
          { title: 'Welfare', description: 'Access welfare programs, mentorship, and alumni networking.' },
        ],
      },
      servicesHeading: { type: String, default: 'Everything You Need' },
      services: {
        type: [{ title: { type: String, required: true }, description: { type: String, required: true }, link: { type: String, required: true } }],
        default: [
          { title: 'Blood Donors', description: 'Find blood donors from your community in emergencies.', link: '/blood-donors' },
          { title: 'Voting & Polls', description: 'Participate in democratic decisions and committee elections.', link: '/voting' },
          { title: 'Bus Schedule', description: 'University and inter-city bus schedules at your fingertips.', link: '/bus-schedule' },
          { title: 'Alumni Network', description: 'Connect with alumni for mentorship and career guidance.', link: '/members' },
          { title: 'Photo Gallery', description: 'Relive memories from events and activities.', link: '/gallery' },
          { title: 'Donations', description: 'Contribute to welfare funds and support fellow students.', link: '/donations' },
        ],
      },
      ctaTitle: { type: String, default: 'Join Us' },
      ctaButtonText: { type: String, default: 'Get Started' },
    },
    faq: {
      type: [{ question: { type: String, required: true }, answer: { type: String, required: true } }],
      default: [
        { question: 'Who can become a member of RDSWA?', answer: 'Any student from Rangpur Division currently studying at the University of Barishal can apply for membership. Alumni who were previously members can retain alumni status.' },
        { question: 'How do I register on the platform?', answer: 'Click the "Register" button on the homepage, fill in your details including student ID and department, and verify your email address. Your membership will be reviewed and approved by the administration.' },
        { question: 'How long does membership approval take?', answer: 'Membership approval typically takes 1-3 business days. You will receive an email notification once your application is reviewed.' },
        { question: 'How can I participate in voting?', answer: 'Active members can participate in elections and polls through the Voting section. Voting is time-limited and each member gets one vote per election.' },
        { question: 'How do I update my profile information?', answer: 'Log in to your account, go to Dashboard > Profile, and update your information. Some fields like student ID may require admin approval to change.' },
        { question: 'Can I donate to RDSWA?', answer: 'Yes! Visit the Donations page to contribute to RDSWA funds or specific campaigns. All donations are tracked and verified by the administration.' },
        { question: 'How do I join the blood donor directory?', answer: 'When updating your profile, make sure your blood group is set and enable the "Available as blood donor" option. You will then appear in the public blood donor directory.' },
        { question: 'Who do I contact for technical issues?', answer: 'For technical issues, reach out to the RDSWA administration through the contact information on the website or use the notification system to send a message.' },
      ],
    },
    privacyPolicy: {
      type: [{ title: { type: String, required: true }, content: { type: String, required: true } }],
      default: [
        { title: 'Information We Collect', content: 'We collect personal information you provide during registration, including your name, email, student ID, phone number, blood group, and department. We also collect usage data such as login history and activity logs for security purposes.' },
        { title: 'How We Use Your Information', content: 'Your information is used to manage membership, facilitate communication, organize events, enable voting, and maintain the blood donor directory. We do not sell or share your data with third parties for commercial purposes.' },
        { title: 'Data Security', content: 'We implement industry-standard security measures including encrypted passwords, JWT-based authentication, rate limiting, and secure HTTPS connections to protect your personal information.' },
        { title: 'Your Rights', content: 'You have the right to access, update, or request deletion of your personal data. You can update your profile information from the dashboard or contact the administration for data-related requests.' },
        { title: 'Cookies & Sessions', content: 'We use essential cookies for authentication and session management. These cookies are necessary for the platform to function and cannot be disabled while using the service.' },
        { title: 'Contact', content: 'For privacy-related concerns, contact the RDSWA administration through the official communication channels or email us directly.' },
      ],
    },
    termsConditions: {
      type: [{ title: { type: String, required: true }, content: { type: String, required: true } }],
      default: [
        { title: 'Acceptance of Terms', content: 'By registering and using the RDSWA platform, you agree to these terms and conditions. If you do not agree, please refrain from using the platform.' },
        { title: 'Membership', content: 'Membership is open to students from Rangpur Division studying at the University of Barishal. Members must provide accurate information during registration. Membership approval is subject to verification by the administration.' },
        { title: 'Code of Conduct', content: 'Members are expected to maintain respectful and professional behavior. Any form of harassment, discrimination, or misuse of the platform will result in account suspension or termination.' },
        { title: 'Prohibited Activities', content: 'Users must not attempt to gain unauthorized access, distribute malicious content, impersonate others, manipulate voting processes, or use the platform for any unlawful purpose.' },
        { title: 'Account Suspension', content: 'The administration reserves the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or compromise the security of the platform.' },
        { title: 'Changes to Terms', content: 'RDSWA reserves the right to update these terms at any time. Members will be notified of significant changes through the platform\'s notification system.' },
      ],
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
