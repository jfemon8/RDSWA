import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import committeeRoutes from './committee.routes';
import eventRoutes from './event.routes';
import noticeRoutes from './notice.routes';
import documentRoutes from './document.routes';
import galleryRoutes from './gallery.routes';
import donationRoutes from './donation.routes';
import expenseRoutes from './expense.routes';
import voteRoutes from './vote.routes';
import formRoutes from './form.routes';
import busRoutes from './bus.routes';
import notificationRoutes from './notification.routes';
import reportRoutes from './report.routes';
import settingsRoutes from './settings.routes';
import adminRoutes from './admin.routes';
import communicationRoutes from './communication.routes';
import mentorshipRoutes from './mentorship.routes';
import jobRoutes from './job.routes';
import budgetRoutes from './budget.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/committees', committeeRoutes);
router.use('/events', eventRoutes);
router.use('/notices', noticeRoutes);
router.use('/documents', documentRoutes);
router.use('/gallery', galleryRoutes);
router.use('/donations', donationRoutes);
router.use('/expenses', expenseRoutes);
router.use('/votes', voteRoutes);
router.use('/forms', formRoutes);
router.use('/bus', busRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/settings', settingsRoutes);
router.use('/admin', adminRoutes);
router.use('/communication', communicationRoutes);
router.use('/mentorships', mentorshipRoutes);
router.use('/jobs', jobRoutes);
router.use('/budgets', budgetRoutes);
router.use('/upload', uploadRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
