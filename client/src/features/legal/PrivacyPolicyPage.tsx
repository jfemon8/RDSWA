import { BlurText, FadeIn } from '@/components/reactbits';
import { motion } from 'motion/react';
import { Shield, Eye, Lock, Database, UserCheck, Mail } from 'lucide-react';

const sections = [
  {
    icon: Eye,
    title: 'Information We Collect',
    content: 'We collect personal information you provide during registration, including your name, email, student ID, phone number, blood group, and department. We also collect usage data such as login history and activity logs for security purposes.',
  },
  {
    icon: Database,
    title: 'How We Use Your Information',
    content: 'Your information is used to manage membership, facilitate communication, organize events, enable voting, and maintain the blood donor directory. We do not sell or share your data with third parties for commercial purposes.',
  },
  {
    icon: Lock,
    title: 'Data Security',
    content: 'We implement industry-standard security measures including encrypted passwords, JWT-based authentication, rate limiting, and secure HTTPS connections to protect your personal information.',
  },
  {
    icon: UserCheck,
    title: 'Your Rights',
    content: 'You have the right to access, update, or request deletion of your personal data. You can update your profile information from the dashboard or contact the administration for data-related requests.',
  },
  {
    icon: Shield,
    title: 'Cookies & Sessions',
    content: 'We use essential cookies for authentication and session management. These cookies are necessary for the platform to function and cannot be disabled while using the service.',
  },
  {
    icon: Mail,
    title: 'Contact',
    content: 'For privacy-related concerns, contact the RDSWA administration through the official communication channels or email us directly.',
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <BlurText
        text="Privacy Policy"
        className="text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-10">
          RDSWA is committed to protecting your privacy. This policy outlines how we collect, use, and safeguard your personal information.
        </p>
      </FadeIn>

      <div className="space-y-6">
        {sections.map((section, i) => (
          <FadeIn key={section.title} delay={i * 0.06} direction="up">
            <motion.div
              whileHover={{ y: -2 }}
              className="rounded-xl border bg-card p-6"
            >
              <div className="flex items-start gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 + i * 0.06 }}
                  className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0"
                >
                  <section.icon className="h-5 w-5" />
                </motion.div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
                </div>
              </div>
            </motion.div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.5}>
        <p className="text-xs text-muted-foreground text-center mt-10">
          Last updated: March 2026
        </p>
      </FadeIn>
    </div>
  );
}
