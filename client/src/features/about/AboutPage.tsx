import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { Users, Target, Eye, BookOpen, Info } from 'lucide-react';
import { FadeIn, BlurText, SpotlightCard } from '@/components/reactbits';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';

export default function AboutPage() {
  const { data } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });

  const settings = data?.data;

  const cards = [
    { icon: Target, title: 'Our Mission', content: settings?.missionContent, color: 'rgba(59, 130, 246, 0.15)' },
    { icon: Eye, title: 'Our Vision', content: settings?.visionContent, color: 'rgba(139, 92, 246, 0.15)' },
    { icon: BookOpen, title: 'Objectives', content: settings?.objectivesContent, color: 'rgba(236, 72, 153, 0.15)' },
    { icon: Users, title: 'History', content: settings?.historyContent, color: 'rgba(34, 197, 94, 0.15)' },
  ].filter((c) => c.content);

  return (
    <div className="container mx-auto py-6 md:py-12">
      <SEO title="About Us" description="Learn about RDSWA — our mission, vision, objectives, and history at University of Barishal." />
      <BlurText
        text="About RDSWA"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8 justify-center md:justify-start"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      {settings?.aboutContent ? (
        <FadeIn delay={0.2} blur>
          <div className="prose dark:prose-invert max-w-none mb-12">
            <RichContent html={settings.aboutContent} className="text-muted-foreground text-lg leading-relaxed" />
          </div>
        </FadeIn>
      ) : (
        <FadeIn delay={0.2} blur>
          <div className="text-center py-8 mb-8">
            <Info className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-muted-foreground text-sm">About content has not been added yet.</p>
          </div>
        </FadeIn>
      )}

      {cards.length > 0 && (
        <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          {cards.map((item, i) => (
            <FadeIn key={item.title} delay={0.1 + i * 0.1} direction="up" scale>
              <SpotlightCard className="bg-card border-border p-6 h-full" spotlightColor={item.color}>
                <div>
                  <div className="flex items-center gap-3 mb-3 text-primary">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                  </div>
                  <RichContent html={item.content} className="text-sm text-muted-foreground leading-relaxed" />
                </div>
              </SpotlightCard>
            </FadeIn>
          ))}
        </div>
      )}

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
