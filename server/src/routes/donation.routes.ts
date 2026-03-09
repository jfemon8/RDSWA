import { Router } from 'express';
import * as donationController from '../controllers/donation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { UserRole } from '@rdswa/shared';
import { createDonationSchema, verifyDonationSchema, createCampaignSchema, updateCampaignSchema } from '../validators/donation.validator';

const router = Router();

router.get('/', authenticate(true), donationController.list);
router.get('/campaigns', donationController.listCampaigns);
router.get('/:id', donationController.getById);
router.post('/', authenticate(true), validate({ body: createDonationSchema }), donationController.create);
router.patch('/:id/verify', authenticate(), authorize(UserRole.ADMIN), validate({ body: verifyDonationSchema }), auditLog('donation.verify', 'donations'), donationController.verifyPayment);
router.post('/campaigns', authenticate(), authorize(UserRole.ADMIN), validate({ body: createCampaignSchema }), auditLog('campaign.create', 'donation_campaigns'), donationController.createCampaign);
router.patch('/campaigns/:id', authenticate(), authorize(UserRole.ADMIN), validate({ body: updateCampaignSchema }), auditLog('campaign.update', 'donation_campaigns'), donationController.updateCampaign);

export default router;
