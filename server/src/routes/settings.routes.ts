import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { SiteSettings, User, Event } from '../models';
import { UserRole } from '@rdswa/shared';
import { cacheResponse } from '../middlewares/cache.middleware';

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
      siteNameBn: settings.siteNameBn,
      logo: settings.logo,
      favicon: settings.favicon,
      theme: settings.theme,
      primaryColor: settings.primaryColor,
      socialLinks: settings.socialLinks,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      address: settings.address,
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
router.patch('/', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('settings.update', 'site_settings'), asyncHandler(async (req, res) => {
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

// Update about content (Admin+)
router.patch('/about', authenticate(), authorize(UserRole.ADMIN), auditLog('settings.update_about', 'site_settings'), asyncHandler(async (req, res) => {
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

export default router;
