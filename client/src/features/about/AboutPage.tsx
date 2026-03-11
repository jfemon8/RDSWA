import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Users, Target, Eye, BookOpen } from 'lucide-react';
import { FadeIn, BlurText, SpotlightCard } from '@/components/reactbits';
import { motion } from 'motion/react';
import SEO from '@/components/SEO';

export default function AboutPage() {
  const { data } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });

  const settings = data?.data;

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <SEO title="About Us" description="Learn about RDSWA — our mission, vision, objectives, and history at University of Barishal." />
      <BlurText
        text="About RDSWA"
        className="text-3xl md:text-4xl font-bold mb-8 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.2} blur>
        {settings?.aboutContent ? (
          <div className="prose dark:prose-invert max-w-none mb-12" dangerouslySetInnerHTML={{ __html: settings.aboutContent }} />
        ) : (
          <p className="text-muted-foreground mb-12 text-lg leading-relaxed">
            Rangpur Divisional Student Welfare Association (RDSWA) is a student welfare organization at University of Barishal,
            dedicated to supporting students from the Rangpur Division.
          </p>
        )}
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {[
          { icon: Target, title: 'Our Mission', content: settings?.missionContent || 'To promote welfare, unity, and academic excellence among students from Rangpur Division studying at University of Barishal.', color: 'rgba(59, 130, 246, 0.15)' },
          { icon: Eye, title: 'Our Vision', content: settings?.visionContent || 'A connected community where every student from Rangpur Division thrives academically, professionally, and socially.', color: 'rgba(139, 92, 246, 0.15)' },
          { icon: BookOpen, title: 'Objectives', content: settings?.objectivesContent || 'Foster brotherhood, organize cultural and educational events, provide academic support, and build a strong alumni network.', color: 'rgba(236, 72, 153, 0.15)' },
          { icon: Users, title: 'History', content: settings?.historyContent || 'Founded by students from Rangpur Division to create a supportive community and preserve regional culture at University of Barishal.', color: 'rgba(34, 197, 94, 0.15)' },
        ].map((item, i) => (
          <FadeIn key={item.title} delay={0.1 + i * 0.1} direction="up" scale>
            <SpotlightCard className="bg-card border-border p-6 h-full" spotlightColor={item.color}>
              <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <div className="flex items-center gap-3 mb-3 text-primary">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
              </motion.div>
            </SpotlightCard>
          </FadeIn>
        ))}
      </div>

      {settings?.contactEmail && (
        <FadeIn delay={0.3}>
          <div className="border rounded-xl p-6 bg-card">
            <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
            <div className="space-y-2 text-sm text-muted-foreground">
              {settings.contactEmail && <p>Email: <a href={`mailto:${settings.contactEmail}`} className="text-primary hover:underline">{settings.contactEmail}</a></p>}
              {settings.contactPhone && <p>Phone: {settings.contactPhone}</p>}
              {settings.address && <p>Address: {settings.address}</p>}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
