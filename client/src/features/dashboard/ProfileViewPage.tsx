import { useAuthStore } from '@/stores/authStore';
import { Link } from 'react-router-dom';
import { Edit, User, Phone, Mail, Calendar, Droplets, MapPin, GraduationCap, Briefcase, Globe, Facebook, Linkedin, Building2 } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { getEffectiveRoles, getRoleConfig } from '@/lib/roles';

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export default function ProfileViewPage() {
  const { user } = useAuthStore();

  if (!user) return null;

  const u = user as any;

  const formatDate = (d: string | Date | undefined) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatAddress = (addr: any) => {
    if (!addr) return null;
    const parts = [addr.upazila, addr.district, addr.division].filter(Boolean);
    if (addr.details) parts.unshift(addr.details);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <BlurText text="My Profile" className="text-2xl sm:text-3xl font-bold" delay={80} animateBy="words" direction="bottom" />
        <FadeIn delay={0.3}>
          <Link
            to="/dashboard/profile/edit"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Edit className="h-4 w-4" /> Edit Profile
          </Link>
        </FadeIn>
      </div>

      {/* Avatar & Basic Info */}
      <FadeIn delay={0.1} direction="up">
        <div className="border rounded-xl p-6 bg-card mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {u.avatar ? (
              <motion.img
                src={u.avatar}
                alt=""
                className="h-24 w-24 rounded-full object-cover border-2 border-primary/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              />
            ) : (
              <motion.div
                className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold border-2 border-primary/20"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                {u.name?.[0]}
              </motion.div>
            )}
            <div className="text-center sm:text-left">
              <h2 className="text-xl font-bold">{u.name}</h2>
              {u.nameBn && <p className="text-muted-foreground">{u.nameBn}</p>}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-2">
                {getEffectiveRoles(u.role).map((r: string, i: number) => {
                  const rc = getRoleConfig(r);
                  return (
                    <motion.span
                      key={r}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.04 }}
                      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${rc.bg} ${rc.text}`}
                    >
                      {rc.label}
                    </motion.span>
                  );
                })}
                {u.isAlumni && !getEffectiveRoles(u.role).includes('alumni') && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full"
                  >
                    <GraduationCap className="h-3 w-3" /> Alumni
                  </motion.span>
                )}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <FadeIn delay={0.15} direction="up">
          <Section title="Personal Information" icon={<User className="h-4 w-4" />}>
            <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={u.email} />
            <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={u.phone} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Date of Birth" value={formatDate(u.dateOfBirth)} />
            <InfoRow label="Gender" value={u.gender ? u.gender.charAt(0).toUpperCase() + u.gender.slice(1) : null} />
            <InfoRow icon={<Droplets className="h-4 w-4" />} label="Blood Group" value={u.bloodGroup} />
            <InfoRow label="Blood Donor" value={u.isBloodDonor ? 'Yes' : 'No'} />
            {u.lastDonationDate && <InfoRow label="Last Donation" value={formatDate(u.lastDonationDate)} />}
          </Section>
        </FadeIn>

        {/* Academic Info */}
        <FadeIn delay={0.2} direction="up">
          <Section title="Academic Information" icon={<GraduationCap className="h-4 w-4" />}>
            <InfoRow label="Student ID / Roll Number" value={u.studentId} />
            <InfoRow label="Registration Number" value={u.registrationNumber} />
            <InfoRow label="University Batch" value={u.batch ? `${u.batch}${getOrdinal(u.batch)}` : null} />
            <InfoRow label="Session" value={u.session} />
            <InfoRow label="Faculty" value={u.faculty} />
            <InfoRow label="Department" value={u.department} />
          </Section>
        </FadeIn>

        {/* Address */}
        <FadeIn delay={0.25} direction="up">
          <Section title="Address" icon={<MapPin className="h-4 w-4" />}>
            <InfoRow label="Present Address" value={formatAddress(u.presentAddress)} />
            <InfoRow label="Permanent Address" value={formatAddress(u.permanentAddress)} />
            {u.homeDistrict && <InfoRow label="Home District" value={u.homeDistrict} />}
          </Section>
        </FadeIn>

        {/* Professional Info */}
        <FadeIn delay={0.3} direction="up">
          <Section title="Professional Information" icon={<Briefcase className="h-4 w-4" />}>
            <InfoRow label="Profession" value={u.profession} />
            <InfoRow label="Earning Source" value={u.earningSource} />
            {u.skills?.length > 0 && (
              <div className="py-2">
                <p className="text-xs text-muted-foreground mb-1.5">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {u.skills.map((s: string, i: number) => (
                    <motion.span
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 + i * 0.03 }}
                      className="px-2 py-0.5 text-xs bg-muted rounded-full"
                    >
                      {s}
                    </motion.span>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </FadeIn>

        {/* Job History */}
        {u.jobHistory?.length > 0 && (
          <FadeIn delay={0.35} direction="up">
            <Section title="Job History" icon={<Building2 className="h-4 w-4" />}>
              <div className="space-y-3">
                {u.jobHistory.map((job: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35 + i * 0.05 }}
                    className="p-3 border rounded-lg bg-background"
                  >
                    <p className="font-medium text-sm">{job.position || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{job.company || 'N/A'}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {job.startDate && <span>{formatDate(job.startDate)}</span>}
                      {job.startDate && <span>-</span>}
                      <span>{job.isCurrent ? 'Present' : job.endDate ? formatDate(job.endDate) : 'N/A'}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </Section>
          </FadeIn>
        )}

        {/* Business Info */}
        {u.businessInfo?.length > 0 && (
          <FadeIn delay={0.4} direction="up">
            <Section title="Business Info" icon={<Briefcase className="h-4 w-4" />}>
              <div className="space-y-3">
                {u.businessInfo.map((biz: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    className="p-3 border rounded-lg bg-background"
                  >
                    <p className="font-medium text-sm">{biz.businessName || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{biz.type || 'N/A'}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {biz.startDate && <span>Since {formatDate(biz.startDate)}</span>}
                      {biz.isCurrent && <span className="text-green-600">Active</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Section>
          </FadeIn>
        )}

        {/* Social Links */}
        <FadeIn delay={0.45} direction="up">
          <Section title="Social Links" icon={<Globe className="h-4 w-4" />}>
            <InfoRow icon={<Facebook className="h-4 w-4" />} label="Facebook" value={u.facebook} isLink />
            <InfoRow icon={<Linkedin className="h-4 w-4" />} label="LinkedIn" value={u.linkedin} isLink />
            <InfoRow icon={<Globe className="h-4 w-4" />} label="Website" value={u.website} isLink />
          </Section>
        </FadeIn>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-5 bg-card h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary">{icon}</span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function InfoRow({ icon, label, value, isLink }: { icon?: React.ReactNode; label: string; value: any; isLink?: boolean }) {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div className="flex items-start gap-3 py-2">
      {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isLink ? (
          <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
            {String(value)}
          </a>
        ) : (
          <p className="text-sm font-medium break-words">{String(value)}</p>
        )}
      </div>
    </div>
  );
}
