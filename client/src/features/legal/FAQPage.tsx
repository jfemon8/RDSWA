import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import RichContent from '@/components/ui/RichContent';
import SEO from '@/components/SEO';

function FAQItem({ faq, index }: { faq: { question: string; answer: string }; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <FadeIn delay={index * 0.05} direction="up">
      <div
        className="rounded-xl border bg-card overflow-hidden"
      >
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <span className="font-medium pr-4 text-foreground">{faq.question}</span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          </motion.div>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="px-5 pb-5">
                <RichContent html={faq.answer} className="text-sm text-muted-foreground leading-relaxed" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FadeIn>
  );
}

export default function FAQPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const faqs: Array<{ question: string; answer: string }> = data?.data?.faq || [];

  return (
    <div className="container mx-auto py-12">
      <SEO title="FAQ" description="Frequently asked questions about RDSWA membership and the platform." />
      <BlurText
        text="Frequently Asked Questions"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-10">
          Find answers to common questions about RDSWA membership and the platform.
        </p>
      </FadeIn>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : faqs.length === 0 ? (
        <FadeIn>
          <p className="text-center text-muted-foreground py-12">No FAQs available yet.</p>
        </FadeIn>
      ) : (
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <FAQItem key={i} faq={faq} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
