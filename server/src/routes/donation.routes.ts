import { Router } from 'express';
import * as donationController from '../controllers/donation.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { UserRole } from '@rdswa/shared';
import { createDonationSchema, updateDonationSchema, verifyDonationSchema, createCampaignSchema, updateCampaignSchema } from '../validators/donation.validator';

const router = Router();

// Public: get active payment methods (mobile banking numbers)
router.get('/payment-methods', donationController.getPaymentMethods);

router.get('/', authenticate(true), donationController.list);
router.get('/campaigns', donationController.listCampaigns);
router.get('/my', authenticate(), donationController.myDonations);
// Both carry the donor's contact and payment identifiers, so neither may be read anonymously.
router.get('/:id', authenticate(), donationController.getById);
router.get('/:id/receipt', authenticate(), donationController.getReceipt);
router.post('/', authenticate(true), validate({ body: createDonationSchema }), donationController.create);
router.patch('/:id/verify', authenticate(), authorize(UserRole.ADMIN), validate({ body: verifyDonationSchema }), auditLog('donation.verify', 'donations'), donationController.verifyPayment);
router.patch('/:id', authenticate(), authorize(UserRole.ADMIN), validate({ body: updateDonationSchema }), auditLog('donation.update', 'donations'), donationController.update);
router.post('/campaigns', authenticate(), authorize(UserRole.ADMIN), validate({ body: createCampaignSchema }), auditLog('campaign.create', 'donation_campaigns'), donationController.createCampaign);
router.patch('/campaigns/:id', authenticate(), authorize(UserRole.ADMIN), validate({ body: updateCampaignSchema }), auditLog('campaign.update', 'donation_campaigns'), donationController.updateCampaign);

// Admin: delete donation
router.delete('/:id', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('donation.delete', 'donations'), donationController.remove);

// Admin: delete campaign
router.delete('/campaigns/:id', authenticate(), authorize(UserRole.SUPER_ADMIN), auditLog('campaign.delete', 'donation_campaigns'), async (req, res, next) => {
  try {
    const { DonationCampaign } = await import('../models');
    const campaign = await DonationCampaign.findByIdAndUpdate(req.params.id as string, { isDeleted: true }, { new: true });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) { next(err); }
});

export default router;
