import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { SiteSettings } from '../models';
import { UserRole } from '@rdswa/shared';

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
      homePageContent: settings.homePageContent,
    };
    return ApiResponse.success(res, publicFields);
  }

  ApiResponse.success(res, settings);
}));

// Update site settings (SuperAdmin)
router.patch('/', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('settings.update', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  let settings = await SiteSettings.findOne();
  if (!settings) settings = new SiteSettings();
  Object.assign(settings, req.body);
  settings.updatedBy = req.user._id as any;
  await settings.save();
  ApiResponse.success(res, settings, 'Settings updated');
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
router.patch('/payment', authenticate(), authorize(UserRole.ADMIN), auditLog('settings.update_payment', 'site_settings'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: { paymentGateway: req.body.paymentGateway, updatedBy: req.user._id } },
    { new: true, upsert: true }
  );
  ApiResponse.success(res, settings, 'Payment settings updated');
}));

export default router;
