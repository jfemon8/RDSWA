import { BlurText, FadeIn } from '@/components/reactbits';
import { motion } from 'motion/react';
import { FileText, Users, AlertTriangle, Ban, Scale, RefreshCw } from 'lucide-react';

const sections = [
  {
    icon: FileText,
    title: 'Acceptance of Terms',
    content: 'By registering and using the RDSWA platform, you agree to these terms and conditions. If you do not agree, please refrain from using the platform.',
  },
  {
    icon: Users,
    title: 'Membership',
    content: 'Membership is open to students from Rangpur Division studying at the University of Barishal. Members must provide accurate information during registration. Membership approval is subject to verification by the administration.',
  },
  {
    icon: Scale,
    title: 'Code of Conduct',
    content: 'Members are expected to maintain respectful and professional behavior. Any form of harassment, discrimination, or misuse of the platform will result in account suspension or termination.',
  },
  {
    icon: Ban,
    title: 'Prohibited Activities',
    content: 'Users must not attempt to gain unauthorized access, distribute malicious content, impersonate others, manipulate voting processes, or use the platform for any unlawful purpose.',
  },
  {
    icon: AlertTriangle,
    title: 'Account Suspension',
    content: 'The administration reserves the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or compromise the security of the platform.',
  },
  {
    icon: RefreshCw,
    title: 'Changes to Terms',
    content: 'RDSWA reserves the right to update these terms at any time. Members will be notified of significant changes through the platform\'s notification system.',
  },
];

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <BlurText
        text="Terms & Conditions"
        className="text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-10">
          Please read these terms carefully before using the RDSWA platform.
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
