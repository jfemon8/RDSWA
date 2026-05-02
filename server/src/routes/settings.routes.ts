import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize, denyRestricted } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { validate } from '../middlewares/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { SiteSettings, User, Event, ContactMessage } from '../models';
import { UserRole, SETTINGS_RESTRICTED_SUPER_ADMINS, CommitteePosition } from '@rdswa/shared';
import { cacheResponse } from '../middlewares/cache.middleware';
import { sendEmail } from '../config/mail';
import { env } from '../config/env';

const router = Router();

// Get site settings (public subset for guests, full for admins)
router.get('/', authenticate(true), asyncHandler(async (req, res) => {
  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create({});
  }

  // Non-admin: return only public fields
  if (!req.user || ![UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role as UserRole)) {
    const publicFields = {
      siteName: settings.siteName,
      siteNameFull: settings.siteNameFull,
      siteNameBn: settings.siteNameBn,
      siteNameBnFull: settings.siteNameBnFull,
      logo: settings.logo,
      logoDark: settings.logoDark,
      footerLogo: settings.footerLogo,
      footerLogoDark: settings.footerLogoDark,
      favicon: settings.favicon,
      theme: settings.theme,
      primaryColor: settings.primaryColor,
      socialLinks: settings.socialLinks,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      address: settings.address,
      brandColors: settings.brandColors,
      aboutContent: settings.aboutContent,
      missionContent: settings.missionContent,
      visionContent: settings.visionContent,
      objectivesContent: settings.objectivesContent,
      historyContent: settings.historyContent,
      universityInfo: settings.universityInfo,
      foundedYear: settings.foundedYear,
      homePageContent: settings.homePageContent,
      academicConfig: settings.academicConfig,
      otherOrganizations: settings.otherOrganizations,
      faq: settings.faq,
      privacyPolicy: settings.privacyPolicy,
      termsConditions: settings.termsConditions,
      updatedAt: settings.updatedAt,
    };
    return ApiResponse.success(res, publicFields);
  }

  ApiResponse.success(res, settings);
}));

// Public stats for homepage
router.get('/public-stats', asyncHandler(async (_req, res) => {
  const [totalMembers, totalEvents, districts] = await Promise.all([
    User.countDocuments({ membershipStatus: 'approved', isDeleted: false }),
    Event.countDocuments({ isDeleted: false }),
    User.distinct('homeDistrict', { homeDistrict: { $exists: true, $ne: '' }, isDeleted: false }),
  ]);

  ApiResponse.success(res, {
    totalMembers,
    totalEvents,
    totalDistricts: districts.length,
  });
}));

// Update site settings (SuperAdmin)
router.patch('/', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();

  // Recursively strip _id and __v from any object/array
  function sanitize(obj: any): any {
    if (Array.isArray(obj)) return obj.map(sanitize);
    if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
      const clean: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === '_id' || k === '__v') continue;
        clean[k] = sanitize(v);
      }
      return clean;
    }
    return obj;
  }

  const body = sanitize(req.body);
  body.updatedBy = req.user._id;

  let settings = await SiteSettings.findOne();
  if (!settings) {
    settings = await SiteSettings.create(body);
  } else {
    // Use set() + save({ validateBeforeSave: false }) for reliable partial updates
    for (const [key, value] of Object.entries(body)) {
      settings.set(key, value);
    }
    await settings.save({ validateBeforeSave: false });
  }

  ApiResponse.success(res, settings, 'Settings updated');
}));

// Get academic config (public — needed for registration/profile dropdowns)
router.get('/academic-config', cacheResponse(300), asyncHandler(async (_req, res) => {
  let settings = await SiteSettings.findOne();
  if (!settings) settings = await SiteSettings.create({});
  ApiResponse.success(res, settings.academicConfig);
}));

// Update academic config (Admin+)
router.patch('/academic-config', authenticate(), authorize(UserRole.ADMIN), auditLog('settings.update_academic', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { batches, sessions, faculties } = req.body;
  const update: any = { updatedBy: req.user._id };
  if (batches !== undefined) update['academicConfig.batches'] = batches;
  if (sessions !== undefined) update['academicConfig.sessions'] = sessions;
  if (faculties !== undefined) {
    // Strip _id from faculty subdocuments
    update['academicConfig.faculties'] = (faculties as any[]).map(({ _id, departments, ...rest }: any) => ({
      ...rest,
      departments: departments || [],
    }));
  }
  const settings = await SiteSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
  ApiResponse.success(res, settings.academicConfig, 'Academic config updated');
}));

// Update homepage content (SuperAdmin)
router.patch('/homepage', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update_homepage', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const update: any = { updatedBy: req.user._id };
  if (req.body.homePageContent !== undefined) update.homePageContent = req.body.homePageContent;
  const settings = await SiteSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
  ApiResponse.success(res, settings, 'Homepage content updated');
}));

// Update university info (SuperAdmin)
router.patch('/university', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update_university', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const uni = req.body.universityInfo || {};
  // Strip _id
  const { _id, ...cleanUni } = uni;
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: { universityInfo: cleanUni, updatedBy: req.user._id } },
    { new: true, upsert: true }
  );
  ApiResponse.success(res, settings, 'University info updated');
}));

// Update about content (SuperAdmin)
router.patch('/about', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update_about', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { aboutContent, missionContent, visionContent, objectivesContent, historyContent } = req.body;
  const update: any = { updatedBy: req.user._id };
  if (aboutContent !== undefined) update.aboutContent = aboutContent;
  if (missionContent !== undefined) update.missionContent = missionContent;
  if (visionContent !== undefined) update.visionContent = visionContent;
  if (objectivesContent !== undefined) update.objectivesContent = objectivesContent;
  if (historyContent !== undefined) update.historyContent = historyContent;

  const settings = await SiteSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
  ApiResponse.success(res, settings, 'Content updated');
}));

// Update general info (Admin+) — name, branding, contact
router.patch('/general', authenticate(), authorize(UserRole.ADMIN), auditLog('settings.update_general', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const allowed = ['siteName', 'siteNameFull', 'siteNameBn', 'siteNameBnFull', 'contactEmail', 'contactPhone', 'address', 'logo', 'logoDark', 'footerLogo', 'footerLogoDark', 'favicon', 'foundedYear'];
  const update: any = { updatedBy: req.user._id };
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  const settings = await SiteSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
  ApiResponse.success(res, settings, 'General settings updated');
}));

// Update brand colors (SuperAdmin only) — controls the CSS primary/secondary
// variables applied app-wide. Empty strings fall back to hardcoded defaults
// baked into client/src/index.css.
const hexColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex color (e.g. #008f57)').or(z.literal(''));
const brandColorsSchema = z.object({
  brandColors: z.object({
    lightPrimary: hexColorSchema.optional(),
    lightSecondary: hexColorSchema.optional(),
    darkPrimary: hexColorSchema.optional(),
    darkSecondary: hexColorSchema.optional(),
  }),
});

router.patch(
  '/brand-colors',
  authenticate(),
  authorize(UserRole.SUPER_ADMIN),
  denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS),
  validate({ body: brandColorsSchema }),
  auditLog('settings.update_brand_colors', 'site_settings'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { brandColors } = req.body as z.infer<typeof brandColorsSchema>;
    // Build $set with dotted paths so we don't replace the entire subdoc
    // (each key is optional — only provided colors update).
    const update: Record<string, unknown> = { updatedBy: req.user._id };
    for (const key of ['lightPrimary', 'lightSecondary', 'darkPrimary', 'darkSecondary'] as const) {
      if (brandColors[key] !== undefined) update[`brandColors.${key}`] = brandColors[key] || undefined;
    }
    const settings = await SiteSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
    ApiResponse.success(res, settings, 'Brand colors updated');
  })
);

// Update organizations (SuperAdmin)
router.patch('/organizations', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update_organizations', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const orgs = (req.body.otherOrganizations || []).map(({ _id, ...rest }: any) => rest);
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: { otherOrganizations: orgs, updatedBy: req.user._id } },
    { new: true, upsert: true }
  );
  ApiResponse.success(res, settings, 'Organizations updated');
}));

// Update legal content (SuperAdmin) — FAQ, Privacy, Terms
router.patch('/legal', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update_legal', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const update: any = { updatedBy: req.user._id };
  if (req.body.faq !== undefined) update.faq = (req.body.faq as any[]).map(({ _id, ...rest }: any) => rest);
  if (req.body.privacyPolicy !== undefined) update.privacyPolicy = (req.body.privacyPolicy as any[]).map(({ _id, ...rest }: any) => rest);
  if (req.body.termsConditions !== undefined) update.termsConditions = (req.body.termsConditions as any[]).map(({ _id, ...rest }: any) => rest);
  const settings = await SiteSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
  ApiResponse.success(res, settings, 'Legal content updated');
}));

// Update social links (SuperAdmin)
router.patch('/social', authenticate(), authorize(UserRole.ADMIN), auditLog('settings.update_social', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: { socialLinks: req.body.socialLinks || {}, updatedBy: req.user._id } },
    { new: true, upsert: true }
  );
  ApiResponse.success(res, settings, 'Social links updated');
}));

// Update payment config (Admin+)
router.patch('/payment', authenticate(), authorize(UserRole.MODERATOR), auditLog('settings.update_payment', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  // Strip _id from each provider subdocument
  const gateway = req.body.paymentGateway || {};
  const cleanGateway: Record<string, any> = {};
  for (const [provider, config] of Object.entries(gateway)) {
    if (provider === '_id') continue;
    const { _id, ...rest } = config as any;
    cleanGateway[provider] = rest;
  }
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: { paymentGateway: cleanGateway, updatedBy: req.user._id } },
    { new: true, upsert: true }
  );
  ApiResponse.success(res, settings, 'Payment settings updated');
}));

// Update voting rules (Admin+)
router.patch('/voting-rules', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update_voting_rules', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: { votingRules: req.body, updatedBy: req.user._id } },
    { new: true, upsert: true }
  );
  ApiResponse.success(res, settings.votingRules, 'Voting rules updated');
}));

// Get voting rules (public)
router.get('/voting-rules', asyncHandler(async (_req, res) => {
  const settings = await SiteSettings.findOne();
  ApiResponse.success(res, settings?.votingRules || {});
}));

// Update membership criteria (SuperAdmin only — only reachable from System Config UI)
router.patch('/membership-criteria', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update_membership_criteria', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: { membershipCriteria: req.body, updatedBy: req.user._id } },
    { new: true, upsert: true }
  );
  ApiResponse.success(res, settings.membershipCriteria, 'Membership criteria updated');
}));

// Get membership criteria (public)
router.get('/membership-criteria', asyncHandler(async (_req, res) => {
  const settings = await SiteSettings.findOne();
  ApiResponse.success(res, settings?.membershipCriteria || {});
}));

// Update auto-role assignment config (SuperAdmin only)
router.patch('/auto-role-config', authenticate(), authorize(UserRole.SUPER_ADMIN), denyRestricted(SETTINGS_RESTRICTED_SUPER_ADMINS), auditLog('settings.update_auto_role', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const { adminPositions, moderatorPositions, advisorOnArchivePositions } = req.body;

  // Validate: each field, when present, must be an array of CommitteePosition values.
  const validPositions = new Set(Object.values(CommitteePosition));
  const checkArray = (label: string, val: unknown) => {
    if (val === undefined) return;
    if (!Array.isArray(val)) throw ApiError.badRequest(`${label} must be an array`);
    for (const p of val) {
      if (typeof p !== 'string' || !validPositions.has(p as CommitteePosition)) {
        throw ApiError.badRequest(`${label} contains invalid position: ${p}`);
      }
    }
  };
  checkArray('adminPositions', adminPositions);
  checkArray('moderatorPositions', moderatorPositions);
  checkArray('advisorOnArchivePositions', advisorOnArchivePositions);

  // No-overlap rule: a single position cannot grant both Admin and Moderator.
  if (Array.isArray(adminPositions) && Array.isArray(moderatorPositions)) {
    const overlap = adminPositions.filter((p) => moderatorPositions.includes(p));
    if (overlap.length > 0) {
      throw ApiError.badRequest(
        `Positions cannot grant both Admin and Moderator: ${overlap.join(', ')}`
      );
    }
  }

  const update: any = { updatedBy: req.user._id };
  if (Array.isArray(adminPositions)) update['autoRoleConfig.adminPositions'] = adminPositions;
  if (Array.isArray(moderatorPositions)) update['autoRoleConfig.moderatorPositions'] = moderatorPositions;
  if (Array.isArray(advisorOnArchivePositions)) update['autoRoleConfig.advisorOnArchivePositions'] = advisorOnArchivePositions;
  const settings = await SiteSettings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true });
  ApiResponse.success(res, settings.autoRoleConfig, 'Auto-role config updated');
}));

// Get auto-role config
router.get('/auto-role-config', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const settings = await SiteSettings.findOne();
  ApiResponse.success(res, settings?.autoRoleConfig || {
    adminPositions: [],
    moderatorPositions: [],
    advisorOnArchivePositions: [],
  });
}));

// Public contact form — throttled: 5 submissions / 15 min / IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many contact submissions. Please try again later.' },
});

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Please enter a valid email'),
  subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(200),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000),
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

router.post(
  '/contact',
  contactLimiter,
  validate({ body: contactSchema }),
  asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body as z.infer<typeof contactSchema>;

    const settings = await SiteSettings.findOne();
    const recipient = settings?.contactEmail || env.EMAIL_FROM;

    // Persist to DB first so admins can still manage submissions even if email sending is down
    const record = await ContactMessage.create({
      name,
      email,
      subject,
      message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 500),
    });

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br/>');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #3b82f6;">New Contact Form Submission</h2>
        <p><strong>From:</strong> ${safeName} &lt;${safeEmail}&gt;</p>
        <p><strong>Subject:</strong> ${safeSubject}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;"/>
        <p style="white-space: pre-wrap;">${safeMessage}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;"/>
        <p style="color: #6b7280; font-size: 12px;">
          Sent via the RDSWA contact form. Manage in Admin Panel &gt; Contact Messages.<br/>
          Ref: ${record._id}
        </p>
      </div>
    `;

    if (recipient) {
      try {
        await sendEmail(recipient, `[Contact] ${subject}`, html);
      } catch (err) {
        console.error('[Contact] Failed to send notification email:', err);
        // Do not fail the request — submission is already persisted
      }
    }

    ApiResponse.success(res, null, 'Your message has been sent. We will get back to you soon.');
  })
);

// ═══════════════════════════════════════════
// Admin: Contact message management (Moderator+)
// ═══════════════════════════════════════════

const statusEnum = z.enum(['new', 'read', 'replied', 'archived']);

const listQuerySchema = z.object({
  status: statusEnum.optional(),
  search: z.string().trim().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: statusEnum,
});

const replySchema = z.object({
  reply: z.string().trim().min(5, 'Reply must be at least 5 characters').max(10000),
  subject: z.string().trim().min(3).max(200).optional(),
});

router.get(
  '/contact/messages',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const { status, search } = req.query as z.infer<typeof listQuerySchema>;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));

    const filter: Record<string, unknown> = { isDeleted: false };
    if (status) filter.status = status;
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      filter.$or = [{ name: regex }, { email: regex }, { subject: regex }, { message: regex }];
    }

    const [messages, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('repliedBy', 'name email avatar')
        .lean(),
      ContactMessage.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, messages, total, page, limit);
  })
);

router.get(
  '/contact/messages/stats',
  authenticate(),
  authorize(UserRole.MODERATOR),
  asyncHandler(async (_req, res) => {
    const counts = await ContactMessage.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const stats = { new: 0, read: 0, replied: 0, archived: 0, total: 0 };
    for (const c of counts) {
      const key = c._id as keyof typeof stats;
      if (key in stats) stats[key] = c.count;
      stats.total += c.count;
    }

    ApiResponse.success(res, stats);
  })
);

router.get(
  '/contact/messages/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  asyncHandler(async (req, res) => {
    const msg = await ContactMessage.findOne({ _id: req.params.id, isDeleted: false })
      .populate('repliedBy', 'name email avatar');
    if (!msg) throw ApiError.notFound('Message not found');

    // Mark as read on first fetch if still new
    if (msg.status === 'new') {
      msg.status = 'read';
      msg.readAt = new Date();
      await msg.save();
    }

    ApiResponse.success(res, msg);
  })
);

router.patch(
  '/contact/messages/:id',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: updateStatusSchema }),
  auditLog('contact.message_update', 'contact_message'),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof updateStatusSchema>;
    const update: Record<string, unknown> = { status };
    if (status === 'read') update.readAt = new Date();

    const msg = await ContactMessage.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: update },
      { new: true }
    );
    if (!msg) throw ApiError.notFound('Message not found');
    ApiResponse.success(res, msg, 'Status updated');
  })
);

router.post(
  '/contact/messages/:id/reply',
  authenticate(),
  authorize(UserRole.MODERATOR),
  validate({ body: replySchema }),
  auditLog('contact.message_reply', 'contact_message'),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const { reply, subject } = req.body as z.infer<typeof replySchema>;

    const msg = await ContactMessage.findOne({ _id: req.params.id, isDeleted: false });
    if (!msg) throw ApiError.notFound('Message not found');

    const settings = await SiteSettings.findOne();
    const orgName = settings?.siteNameFull || settings?.siteName || 'RDSWA';
    const replySubject = subject?.trim() || `Re: ${msg.subject}`;
    const safeReply = escapeHtml(reply).replace(/\n/g, '<br/>');
    const safeOriginal = escapeHtml(msg.message).replace(/\n/g, '<br/>');
    const replierName = escapeHtml(req.user.name || 'The RDSWA Team');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
        <p>Hi ${escapeHtml(msg.name)},</p>
        <p>Thank you for reaching out to ${escapeHtml(orgName)}. Here is our reply to your message:</p>
        <div style="border-left: 3px solid #3b82f6; padding: 12px 16px; background: #f9fafb; border-radius: 4px; margin: 16px 0;">
          <p style="white-space: pre-wrap; margin: 0;">${safeReply}</p>
        </div>
        <p>Best regards,<br/>${replierName}<br/><em>${escapeHtml(orgName)}</em></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;"/>
        <details style="color: #6b7280; font-size: 12px;">
          <summary style="cursor: pointer;">Your original message</summary>
          <p><strong>Subject:</strong> ${escapeHtml(msg.subject)}</p>
          <p style="white-space: pre-wrap;">${safeOriginal}</p>
        </details>
      </div>
    `;

    try {
      await sendEmail(msg.email, replySubject, html);
    } catch (err) {
      console.error('[Contact] Failed to send reply:', err);
      throw ApiError.internal('Failed to send reply email. Please try again later.');
    }

    msg.reply = reply;
    msg.repliedBy = req.user._id;
    msg.repliedAt = new Date();
    msg.status = 'replied';
    await msg.save();

    ApiResponse.success(res, msg, 'Reply sent successfully');
  })
);

router.delete(
  '/contact/messages/:id',
  authenticate(),
  authorize(UserRole.ADMIN),
  auditLog('contact.message_delete', 'contact_message'),
  asyncHandler(async (req, res) => {
    const msg = await ContactMessage.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { $set: { isDeleted: true } },
      { new: true }
    );
    if (!msg) throw ApiError.notFound('Message not found');
    ApiResponse.success(res, null, 'Message deleted');
  })
);

export default router;
