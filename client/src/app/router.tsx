import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PublicLayout from '@/layouts/PublicLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import AdminLayout from '@/layouts/AdminLayout';
import RouteGuard from '@/components/guards/RouteGuard';
import GuestGuard from '@/components/guards/GuestGuard';
import RoleGuard from '@/components/guards/RoleGuard';
import AdminRoleGuard from '@/components/guards/AdminRoleGuard';
import { UserRole } from '@rdswa/shared';

// Public pages
const Home = lazy(() => import('@/features/home/HomePage'));
const Login = lazy(() => import('@/features/auth/LoginPage'));
const Register = lazy(() => import('@/features/auth/RegisterPage'));
const ForgotPassword = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPassword = lazy(() => import('@/features/auth/ResetPasswordPage'));
const EmailVerify = lazy(() => import('@/features/auth/EmailVerifyPage'));
const OtpVerify = lazy(() => import('@/features/auth/OtpVerifyPage'));
const About = lazy(() => import('@/features/about/AboutPage'));
const University = lazy(() => import('@/features/university/UniversityPage'));
const Committee = lazy(() => import('@/features/committee/CommitteePage'));
const Members = lazy(() => import('@/features/members/MembersPage'));
const BloodDonors = lazy(() => import('@/features/members/BloodDonorsPage'));
const UserProfile = lazy(() => import('@/features/members/UserProfilePage'));
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
const JobDetail = lazy(() => import('@/features/jobs/JobDetailPage'));
const MentorshipPage = lazy(() => import('@/features/mentorship/MentorshipPage'));
const Alumni = lazy(() => import('@/features/members/AlumniPage'));
const Advisors = lazy(() => import('@/features/members/AdvisorsPage'));
const SeniorAdvisors = lazy(() => import('@/features/members/SeniorAdvisorsPage'));
const NotFound = lazy(() => import('@/features/NotFoundPage'));

// Dashboard pages
const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'));
const ProfileView = lazy(() => import('@/features/dashboard/ProfileViewPage'));
const ProfileEdit = lazy(() => import('@/features/dashboard/ProfilePage'));
const Notifications = lazy(() => import('@/features/dashboard/NotificationsPage'));
const NotificationSettings = lazy(() => import('@/features/dashboard/NotificationSettingsPage'));
const MyForms = lazy(() => import('@/features/dashboard/MyFormsPage'));
const SubmitForm = lazy(() => import('@/features/dashboard/SubmitFormPage'));
const AttendanceHistory = lazy(() => import('@/features/dashboard/AttendanceHistoryPage'));
const MyDonations = lazy(() => import('@/features/dashboard/MyDonationsPage'));

// Communication pages
const Forum = lazy(() => import('@/features/communication/ForumPage'));
const TopicDetail = lazy(() => import('@/features/communication/TopicDetailPage'));
const Messages = lazy(() => import('@/features/communication/MessagesPage'));
const Groups = lazy(() => import('@/features/communication/GroupsPage'));
const GroupChat = lazy(() => import('@/features/communication/GroupChatPage'));
const Announcements = lazy(() => import('@/features/communication/AnnouncementsPage'));

// Admin pages
const AdminDashboard = lazy(() => import('@/features/admin/dashboard/AdminDashboardPage'));
const AdminUsers = lazy(() => import('@/features/admin/users/AdminUsersPage'));
const AdminRoles = lazy(() => import('@/features/admin/roles/AdminRolesPage'));
const AdminModerators = lazy(() => import('@/features/admin/moderators/AdminModeratorsPage'));
const AdminAdmins = lazy(() => import('@/features/admin/admins/AdminAdminsPage'));
const AdminCommittees = lazy(() => import('@/features/admin/committees/AdminCommitteesPage'));
const AdminEvents = lazy(() => import('@/features/admin/events/AdminEventsPage'));
const AdminNotices = lazy(() => import('@/features/admin/notices/AdminNoticesPage'));
const AdminDocuments = lazy(() => import('@/features/admin/documents/AdminDocumentsPage'));
const AdminGallery = lazy(() => import('@/features/admin/gallery/AdminGalleryPage'));
const AdminFinance = lazy(() => import('@/features/admin/finance/AdminFinancePage'));
const AdminVoting = lazy(() => import('@/features/admin/voting/AdminVotingPage'));
const AdminForms = lazy(() => import('@/features/admin/forms/AdminFormsPage'));
const AdminBus = lazy(() => import('@/features/admin/bus/AdminBusPage'));
const AdminReports = lazy(() => import('@/features/admin/reports/AdminReportsPage'));
const AdminNotifications = lazy(() => import('@/features/admin/notifications/AdminNotificationsPage'));
const AdminPaymentConfig = lazy(() => import('@/features/admin/payment/AdminPaymentConfigPage'));
const AdminSettings = lazy(() => import('@/features/admin/settings/AdminSettingsPage'));
const AdminSystemConfig = lazy(() => import('@/features/admin/settings/AdminSystemConfigPage'));
const AdminLogs = lazy(() => import('@/features/admin/logs/AdminLogsPage'));
const AdminAlumniMonitor = lazy(() => import('@/features/admin/alumni/AdminAlumniMonitorPage'));
const AdminAdvisors = lazy(() => import('@/features/admin/advisors/AdminAdvisorsPage'));
const AdminSeniorAdvisors = lazy(() => import('@/features/admin/advisors/AdminSeniorAdvisorsPage'));
const AdminDonations = lazy(() => import('@/features/admin/donations/AdminDonationsPage'));
const AdminJobs = lazy(() => import('@/features/admin/jobs/AdminJobsPage'));
const AdminMentorship = lazy(() => import('@/features/admin/mentorship/AdminMentorshipPage'));
const AdminForum = lazy(() => import('@/features/admin/forum/AdminForumPage'));

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
          {/* Auth routes — redirect to dashboard if already logged in */}
          <Route element={<GuestGuard />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>
          <Route path="/verify-email" element={<EmailVerify />} />
          <Route path="/verify-otp" element={<OtpVerify />} />
          <Route path="/about" element={<About />} />
          <Route path="/university" element={<University />} />
          <Route path="/committee" element={<Committee />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:id" element={<UserProfile />} />
          <Route path="/blood-donors" element={<BloodDonors />} />
          <Route path="/alumni" element={<Alumni />} />
          <Route path="/advisors" element={<Advisors />} />
          <Route path="/senior-advisors" element={<SeniorAdvisors />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/meetings" element={<MeetingRecords />} />
          <Route path="/notices" element={<Notices />} />
          <Route path="/notices/:id" element={<NoticeDetail />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/donations" element={<Donations />} />
          <Route path="/bus-schedule" element={<BusSchedule />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/faq" element={<FAQ />} />
        </Route>

        {/* Dashboard routes (authenticated) */}
        <Route element={<RouteGuard />}>
          <Route element={<DashboardLayout />}>
            <Route path="/voting" element={<Voting />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/jobs" element={<JobBoard />} />
            <Route path="/dashboard/jobs/:id" element={<JobDetail />} />
            <Route path="/dashboard/profile" element={<ProfileView />} />
            <Route path="/dashboard/profile/edit" element={<ProfileEdit />} />
            <Route path="/dashboard/notifications" element={<Notifications />} />
            <Route path="/dashboard/forms" element={<MyForms />} />
            <Route path="/dashboard/forms/new" element={<SubmitForm />} />
            <Route path="/dashboard/forum" element={<Forum />} />
            <Route path="/dashboard/forum/:id" element={<TopicDetail />} />
            <Route path="/dashboard/messages" element={<Messages />} />
            <Route path="/dashboard/groups" element={<Groups />} />
            <Route path="/dashboard/groups/:id" element={<GroupChat />} />
            <Route path="/dashboard/announcements" element={<Announcements />} />
            <Route path="/dashboard/settings" element={<NotificationSettings />} />
            <Route path="/dashboard/mentorship" element={<MentorshipPage />} />
            <Route path="/dashboard/attendance" element={<AttendanceHistory />} />
            <Route path="/dashboard/my-donations" element={<MyDonations />} />
          </Route>
        </Route>

        {/* Admin routes (moderator+) */}
        <Route element={<RouteGuard />}>
          <Route element={<RoleGuard requiredRole={UserRole.MODERATOR} />}>
            <Route element={<AdminLayout />}>
              {/* Moderator+ routes */}
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/committees" element={<AdminCommittees />} />
              <Route path="/admin/events" element={<AdminEvents />} />
              <Route path="/admin/events/:id/checkin" element={<CheckInScanner />} />
              <Route path="/admin/notices" element={<AdminNotices />} />
              <Route path="/admin/documents" element={<AdminDocuments />} />
              <Route path="/admin/gallery" element={<AdminGallery />} />
              <Route path="/admin/voting" element={<AdminVoting />} />
              <Route path="/admin/forms" element={<AdminForms />} />
              <Route path="/admin/alumni-monitor" element={<AdminAlumniMonitor />} />
              <Route path="/admin/advisors" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminAdvisors /></AdminRoleGuard>} />
              <Route path="/admin/senior-advisors" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminSeniorAdvisors /></AdminRoleGuard>} />
              <Route path="/admin/donations" element={<AdminDonations />} />
              <Route path="/admin/jobs" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminJobs /></AdminRoleGuard>} />
              <Route path="/admin/mentorship" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminMentorship /></AdminRoleGuard>} />
              <Route path="/admin/forum" element={<AdminForum />} />
              <Route path="/admin/notifications" element={<AdminNotifications />} />
              <Route path="/admin/payment" element={<AdminPaymentConfig />} />

              {/* Admin+ routes */}
              <Route path="/admin/roles" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminRoles /></AdminRoleGuard>} />
              <Route path="/admin/moderators" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminModerators /></AdminRoleGuard>} />
              <Route path="/admin/finance" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminFinance /></AdminRoleGuard>} />
              <Route path="/admin/bus" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminBus /></AdminRoleGuard>} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/logs" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminLogs /></AdminRoleGuard>} />

              {/* SuperAdmin only */}
              <Route path="/admin/settings" element={<AdminRoleGuard minRole={UserRole.SUPER_ADMIN}><AdminSettings /></AdminRoleGuard>} />
              <Route path="/admin/system-config" element={<AdminRoleGuard minRole={UserRole.ADMIN}><AdminSystemConfig /></AdminRoleGuard>} />
              <Route path="/admin/admins" element={<AdminRoleGuard minRole={UserRole.SUPER_ADMIN}><AdminAdmins /></AdminRoleGuard>} />
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
