import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { GraduationCap, BookOpen, Users, Phone, Mail, MapPin, ExternalLink } from "lucide-react";
import { FadeIn, BlurText } from "@/components/reactbits";
import { motion } from "motion/react";
import SEO from "@/components/SEO";
import RichContent from "@/components/ui/RichContent";
import Spinner from '@/components/ui/Spinner';

export default function UniversityPage() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get("/settings");
      return data;
    },
  });

  const settings = data?.data;
  const uni = settings?.universityInfo;
  const orgs = settings?.otherOrganizations as
    | Array<{ name: string; description: string; website?: string; logo?: string }>
    | undefined;

  if (isLoading) {
    return (
      <Spinner size="md" />
    );
  }

  const hasContact = uni?.phone || uni?.email || uni?.website || uni?.address;

  return (
    <div className="container mx-auto py-8">
      <SEO
        title={uni?.name || 'University of Barishal'}
        description={`About ${uni?.name || 'University of Barishal'} (BU) — overview, history, campus information, departments, faculty, admissions, and campus life. Comprehensive university guide for Rangpur Division students. বরিশাল বিশ্ববিদ্যালয় সম্পর্কে জানুন।`}
        keywords="University of Barishal, BU Bangladesh, Barishal University, ববি, বরিশাল বিশ্ববিদ্যালয়, BU admissions, BU departments, BU campus, Bangladesh public university"
      />

      {/* Header with logo + name */}
      <FadeIn direction="up">
        <div className="flex items-start gap-4 mb-6">
          {uni?.logo && (
            <motion.img
              src={uni.logo}
              alt={uni.name || 'University'}
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-lg shrink-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            />
          )}
          <div>
            <BlurText
              text={uni?.name || "University of Barishal"}
              className="text-2xl sm:text-3xl md:text-4xl font-bold"
              delay={80}
              animateBy="words"
              direction="bottom"
            />
            {uni?.address && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {uni.address}
              </p>
            )}
          </div>
        </div>
      </FadeIn>

      {/* Contact Info */}
      {hasContact && (
        <FadeIn delay={0.1} direction="up">
          <div className="flex flex-wrap gap-4 mb-8 text-sm">
            {uni?.phone && (
              <a href={`tel:${uni.phone.replace(/\s/g, '')}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <Phone className="h-4 w-4" /> {uni.phone}
              </a>
            )}
            {uni?.email && (
              <a href={`mailto:${uni.email}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="h-4 w-4" /> {uni.email}
              </a>
            )}
            {uni?.website && (
              <a href={uni.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                <ExternalLink className="h-4 w-4" /> {uni.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </FadeIn>
      )}

      {/* Overview */}
      {uni?.overview && (
        <FadeIn delay={0.15} direction="up">
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Overview</h2>
            </div>
            <RichContent html={uni.overview} />
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
            <RichContent html={uni.history} />
          </section>
        </FadeIn>
      )}

      {/* Campus Info */}
      {uni?.campusInfo && (
        <FadeIn delay={0.25} direction="up">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Campus Information</h2>
            <RichContent html={uni.campusInfo} />
          </section>
        </FadeIn>
      )}

      {/* Admission Info */}
      {uni?.admissionInfo && (
        <FadeIn delay={0.3} direction="up">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Admission Information</h2>
            <RichContent html={uni.admissionInfo} />
          </section>
        </FadeIn>
      )}

      {/* Google Map */}
      {uni?.mapEmbedUrl && (
        <FadeIn delay={0.35} direction="up">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Location</h2>
            <div className="border rounded-lg overflow-hidden">
              <iframe
                title="University Location"
                width="100%"
                height="400"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={uni.mapEmbedUrl}
              />
            </div>
          </section>
        </FadeIn>
      )}

      {/* Other Organizations */}
      {orgs && orgs.length > 0 && (
        <FadeIn delay={0.4} direction="up">
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Other Organizations</h2>
            </div>
            <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orgs.map((org, i) => (
                <FadeIn key={i} delay={0.1 + i * 0.06} direction="up">
                  <motion.div whileHover={{ y: -2 }} className="border rounded-lg p-4 bg-card h-full">
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
                      <RichContent html={org.description} className="text-sm text-muted-foreground mb-2" />
                    )}
                    {org.website && (
                      <a
                        href={org.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Visit website
                      </a>
                    )}
                  </motion.div>
                </FadeIn>
              ))}
            </div>
          </section>
        </FadeIn>
      )}

      {/* Empty state */}
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
