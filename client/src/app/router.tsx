import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import AdminLayout from '@/layouts/AdminLayout';
import RouteGuard from '@/components/guards/RouteGuard';
import RoleGuard from '@/components/guards/RoleGuard';
import { UserRole } from '@rdswa/shared';

// Public pages
const Home = lazy(() => import('@/features/home/HomePage'));
const Login = lazy(() => import('@/features/auth/LoginPage'));
const Register = lazy(() => import('@/features/auth/RegisterPage'));
const ForgotPassword = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPassword = lazy(() => import('@/features/auth/ResetPasswordPage'));
const EmailVerify = lazy(() => import('@/features/auth/EmailVerifyPage'));
const About = lazy(() => import('@/features/about/AboutPage'));
const University = lazy(() => import('@/features/university/UniversityPage'));
const Committee = lazy(() => import('@/features/committee/CommitteePage'));
const Members = lazy(() => import('@/features/members/MembersPage'));
const BloodDonors = lazy(() => import('@/features/members/BloodDonorsPage'));
const Events = lazy(() => import('@/features/events/EventsPage'));
const EventDetail = lazy(() => import('@/features/events/EventDetailPage'));
const CheckInScanner = lazy(() => import('@/features/events/CheckInScannerPage'));
const MeetingRecords = lazy(() => import('@/features/events/MeetingRecordsPage'));
const Notices = lazy(() => import('@/features/notices/NoticesPage'));
const NoticeDetail = lazy(() => import('@/features/notices/NoticeDetailPage'));
const Documents = lazy(() => import('@/features/documents/DocumentsPage'));
const Donations = lazy(() => import('@/features/donations/DonationsPage'));
const Voting = lazy(() => import('@/features/voting/VotingPage'));
const BusSchedule = lazy(() => import('@/features/bus-schedule/BusSchedulePage'));
const Gallery = lazy(() => import('@/features/gallery/GalleryPage'));
const PrivacyPolicy = lazy(() => import('@/features/legal/PrivacyPolicyPage'));
const Terms = lazy(() => import('@/features/legal/TermsPage'));
const FAQ = lazy(() => import('@/features/legal/FAQPage'));
const JobBoard = lazy(() => import('@/features/jobs/JobBoardPage'));
const MentorshipPage = lazy(() => import('@/features/mentorship/MentorshipPage'));
const NotFound = lazy(() => import('@/features/NotFoundPage'));

// Dashboard pages
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const Profile = lazy(() => import('@/features/dashboard/ProfilePage'));
const Notifications = lazy(() => import('@/features/dashboard/NotificationsPage'));
const MyForms = lazy(() => import('@/features/dashboard/MyFormsPage'));
const SubmitForm = lazy(() => import('@/features/dashboard/SubmitFormPage'));
const AttendanceHistory = lazy(() => import('@/features/dashboard/AttendanceHistoryPage'));

// Admin pages
const AdminDashboard = lazy(() => import('@/features/admin/dashboard/AdminDashboardPage'));
const AdminUsers = lazy(() => import('@/features/admin/users/AdminUsersPage'));
const AdminCommittees = lazy(() => import('@/features/admin/committees/AdminCommitteesPage'));
const AdminEvents = lazy(() => import('@/features/admin/events/AdminEventsPage'));
const AdminNotices = lazy(() => import('@/features/admin/notices/AdminNoticesPage'));
const AdminGallery = lazy(() => import('@/features/admin/gallery/AdminGalleryPage'));
const AdminFinance = lazy(() => import('@/features/admin/finance/AdminFinancePage'));
const AdminVoting = lazy(() => import('@/features/admin/voting/AdminVotingPage'));
const AdminForms = lazy(() => import('@/features/admin/forms/AdminFormsPage'));
const AdminBus = lazy(() => import('@/features/admin/bus/AdminBusPage'));
const AdminNotifications = lazy(() => import('@/features/admin/notifications/AdminNotificationsPage'));
const AdminSettings = lazy(() => import('@/features/admin/settings/AdminSettingsPage'));
const AdminLogs = lazy(() => import('@/features/admin/logs/AdminLogsPage'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<EmailVerify />} />
          <Route path="/about" element={<About />} />
          <Route path="/university" element={<University />} />
          <Route path="/committee" element={<Committee />} />
          <Route path="/members" element={<Members />} />
          <Route path="/blood-donors" element={<BloodDonors />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/meetings" element={<MeetingRecords />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/notices/:id" element={<NoticeDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/donations" element={<Donations />} />
          <Route path="/voting" element={<Voting />} />
          <Route path="/bus-schedule" element={<BusSchedule />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/faq" element={<FAQ />} />
        </Route>

        {/* Dashboard routes (authenticated) */}
        <Route element={<RouteGuard />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/profile" element={<Profile />} />
            <Route path="/dashboard/notifications" element={<Notifications />} />
            <Route path="/dashboard/forms" element={<MyForms />} />
            <Route path="/dashboard/forms/new" element={<SubmitForm />} />
            <Route path="/dashboard/jobs" element={<JobBoard />} />
            <Route path="/dashboard/mentorship" element={<MentorshipPage />} />
            <Route path="/dashboard/attendance" element={<AttendanceHistory />} />
          </Route>
        </Route>

        {/* Admin routes (moderator+) */}
        <Route element={<RouteGuard />}>
          <Route element={<RoleGuard requiredRole={UserRole.MODERATOR} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/committees" element={<AdminCommittees />} />
              <Route path="/admin/events" element={<AdminEvents />} />
              <Route path="/admin/events/:id/checkin" element={<CheckInScanner />} />
              <Route path="/admin/notices" element={<AdminNotices />} />
              <Route path="/admin/gallery" element={<AdminGallery />} />
              <Route path="/admin/finance" element={<AdminFinance />} />
              <Route path="/admin/voting" element={<AdminVoting />} />
              <Route path="/admin/forms" element={<AdminForms />} />
              <Route path="/admin/bus" element={<AdminBus />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/settings" element={<AdminSettings />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
            </Route>
          </Route>
        </Route>

        {/* 404 catch-all */}
        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
