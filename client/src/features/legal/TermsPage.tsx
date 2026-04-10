import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { BlurText, FadeIn } from '@/components/reactbits';
import { motion } from 'motion/react';
import { Scale } from 'lucide-react';
import RichContent from '@/components/ui/RichContent';
import { Skeleton } from '@/components/ui/Skeleton';
import SEO from '@/components/SEO';
import { formatDateCustom } from '@/lib/date';

export default function TermsPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const sections: Array<{ title: string; content: string }> = data?.data?.termsConditions || [];

  return (
    <div className="container mx-auto py-6 md:py-12">
      <SEO title="Terms & Conditions" description="Terms and conditions for using the RDSWA platform." />
      <BlurText
        text="Terms & Conditions"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        <p className="text-muted-foreground mb-10">
          Please read these terms carefully before using the RDSWA platform.
        </p>
      </FadeIn>

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <FadeIn>
          <p className="text-center text-muted-foreground py-12">Terms & conditions content is being prepared.</p>
        </FadeIn>
      ) : (
        <div className="space-y-6">
          {sections.map((section, i) => (
            <FadeIn key={i} delay={i * 0.06} direction="up">
              <div
                className="rounded-xl border bg-card p-6"
              >
                <div className="flex items-start gap-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 + i * 0.06 }}
                    className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0"
                  >
                    <Scale className="h-5 w-5" />
                  </motion.div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-foreground">{section.title}</h3>
                    <RichContent html={section.content} className="text-sm text-muted-foreground leading-relaxed" />
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}

      <FadeIn delay={0.5}>
        <p className="text-xs text-muted-foreground text-center mt-10">
          Last updated: {formatDateCustom(new Date(), { month: 'long', year: 'numeric' })}
        </p>
      </FadeIn>
    </div>
  );
}
