import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { GraduationCap, BookOpen, Loader2, Users } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { motion } from 'motion/react';
import SEO from '@/components/SEO';

export default function UniversityPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });

  const settings = data?.data;
  const uni = settings?.universityInfo;
  const orgs = settings?.otherOrganizations as Array<{ name: string; description: string; website?: string; logo?: string }> | undefined;

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <SEO title="University" description="Learn about University of Barishal — overview, history, campus info, and admissions." />
      <BlurText
        text={settings?.siteName ? `University — ${settings.siteName}` : 'University'}
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2"
        delay={80}
        animateBy="words"
        direction="bottom"
      />
      {(settings?.foundedYear || uni?.contactInfo) && (
        <FadeIn delay={0.2} direction="up">
          <p className="text-muted-foreground mb-8">
            {uni?.contactInfo || (settings?.foundedYear ? `Established ${settings.foundedYear}` : '')}
          </p>
        </FadeIn>
      )}

      {/* Overview */}
      {uni?.overview && (
        <FadeIn delay={0.1} direction="up">
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Overview</h2>
            </div>
            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: uni.overview }} />
          </section>
        </FadeIn>
      )}

      {/* History */}
      {uni?.history && (
        <FadeIn delay={0.2} direction="up">
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">History</h2>
            </div>
            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: uni.history }} />
          </section>
        </FadeIn>
      )}

      {/* Campus Info */}
      {uni?.campusInfo && (
        <FadeIn delay={0.3} direction="up">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Campus Information</h2>
            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: uni.campusInfo }} />
          </section>
        </FadeIn>
      )}

      {/* Admission Info */}
      {uni?.admissionInfo && (
        <FadeIn delay={0.4} direction="up">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Admission Information</h2>
            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: uni.admissionInfo }} />
          </section>
        </FadeIn>
      )}

      {/* Map */}
      {uni?.location?.lat && uni?.location?.lng && (
        <FadeIn delay={0.5} direction="up">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Location</h2>
            <div className="border rounded-lg overflow-hidden">
              <iframe
                title="University Location"
                width="100%"
                height="350"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.google.com/maps?q=${uni.location.lat},${uni.location.lng}&output=embed`}
              />
            </div>
          </section>
        </FadeIn>
      )}

      {/* Other Organizations */}
      {orgs && orgs.length > 0 && (
        <FadeIn delay={0.6} direction="up">
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Other Organizations</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orgs.map((org, i) => (
                <FadeIn key={i} delay={0.1 + i * 0.06} direction="up">
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="border rounded-lg p-4 bg-card h-full"
                  >
                    {org.logo && (
                      <motion.img
                        src={org.logo}
                        alt={org.name}
                        className="h-10 w-10 object-contain mb-2 rounded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      />
                    )}
                    <p className="font-medium text-foreground mb-1">{org.name}</p>
                    {org.description && (
                      <p className="text-sm text-muted-foreground mb-2">{org.description}</p>
                    )}
                    {org.website && (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Visit Website
                      </a>
                    )}
                  </motion.div>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>
      )}

      {/* Empty state when no content at all */}
      {!uni?.overview && !uni?.history && !uni?.campusInfo && !uni?.admissionInfo && (!orgs || orgs.length === 0) && (
        <FadeIn delay={0.2} direction="up">
          <div className="text-center py-12">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">University information has not been configured yet.</p>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
