import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import RichContent from '@/components/ui/RichContent';
import SEO from '@/components/SEO';
import { useAccordionToggle } from '@/hooks/useAccordionScroll';

function FAQItem({
  faq,
  index,
  id,
  open,
  onToggle,
}: {
  faq: { question: string; answer: string };
  index: number;
  id: string;
  open: boolean;
  onToggle: () => void;
}) {
  const answerId = `${id}-answer`;

  return (
    <FadeIn delay={index * 0.05} direction="up">
      <div
        data-accordion-item={id}
        className={`rounded-xl border bg-card overflow-hidden ${open ? 'border-primary/30' : ''}`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={answerId}
          className="w-full flex items-center justify-between p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="font-medium pr-4 text-foreground flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-primary shrink-0" /> {faq.question}
          </span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
          </motion.div>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="answer"
              id={answerId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
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
  const [openId, setOpenId] = useState<string | null>(null);
  const toggleFaq = useAccordionToggle(openId, setOpenId);

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
    <div className="container mx-auto py-6 md:py-12">
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
          {faqs.map((faq, i) => {
            const id = `faq-${i}`;
            return (
              <FAQItem
                key={id}
                id={id}
                faq={faq}
                index={i}
                open={openId === id}
                // Only one answer stays open, and pressing the open question closes it.
                onToggle={() => toggleFaq(id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
