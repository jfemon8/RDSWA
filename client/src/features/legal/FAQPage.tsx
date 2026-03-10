import { useState } from 'react';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    question: 'Who can become a member of RDSWA?',
    answer: 'Any student from Rangpur Division currently studying at the University of Barishal can apply for membership. Alumni who were previously members can retain alumni status.',
  },
  {
    question: 'How do I register on the platform?',
    answer: 'Click the "Register" button on the homepage, fill in your details including student ID and department, and verify your email address. Your membership will be reviewed and approved by the administration.',
  },
  {
    question: 'How long does membership approval take?',
    answer: 'Membership approval typically takes 1-3 business days. You will receive an email notification once your application is reviewed.',
  },
  {
    question: 'How can I participate in voting?',
    answer: 'Active members can participate in elections and polls through the Voting section. Voting is time-limited and each member gets one vote per election.',
  },
  {
    question: 'How do I update my profile information?',
    answer: 'Log in to your account, go to Dashboard > Profile, and update your information. Some fields like student ID may require admin approval to change.',
  },
  {
    question: 'Can I donate to RDSWA?',
    answer: 'Yes! Visit the Donations page to contribute to RDSWA funds or specific campaigns. All donations are tracked and verified by the administration.',
  },
  {
    question: 'How do I join the blood donor directory?',
    answer: 'When updating your profile, make sure your blood group is set and enable the "Available as blood donor" option. You will then appear in the public blood donor directory.',
  },
  {
    question: 'Who do I contact for technical issues?',
    answer: 'For technical issues, reach out to the RDSWA administration through the contact information on the website or use the notification system to send a message.',
  },
];

function FAQItem({ faq, index }: { faq: typeof faqs[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <FadeIn delay={index * 0.05} direction="up">
      <motion.div
        whileHover={{ y: -1 }}
        className="rounded-xl border bg-card overflow-hidden"
      >
        <motion.button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between p-5 text-left"
          whileTap={{ scale: 0.99 }}
        >
          <span className="font-medium pr-4">{faq.question}</span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          </motion.div>
        </motion.button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                {faq.answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </FadeIn>
  );
}

export default function FAQPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <BlurText
        text="Frequently Asked Questions"
        className="text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-10">
          Find answers to common questions about RDSWA membership and the platform.
        </p>
      </FadeIn>

      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <FAQItem key={faq.question} faq={faq} index={i} />
        ))}
      </div>
    </div>
  );
}
