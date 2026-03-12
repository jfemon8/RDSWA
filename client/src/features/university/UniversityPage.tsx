import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { GraduationCap, MapPin, Phone, BookOpen } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';

export default function UniversityPage() {
  const { data } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
  });

  const uni = data?.data?.universityInfo;

  return (
    <div className="mx-auto py-8 px-4 sm:px-6">
      <BlurText
        text="University of Barishal"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2"
        delay={80}
        animateBy="words"
        direction="bottom"
      />
      <FadeIn delay={0.2} direction="up">
        <p className="text-muted-foreground mb-8">University of Barishal — Established 2011</p>
      </FadeIn>

      {/* Overview */}
      <FadeIn delay={0.1} direction="up">
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Overview</h2>
          </div>
          {uni?.overview ? (
            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: uni.overview }} />
          ) : (
            <p className="text-muted-foreground">
              The University of Barishal is a public university located in Barishal, Bangladesh. Established in 2011,
              it offers undergraduate and postgraduate programs across multiple faculties including Science & Engineering,
              Arts & Humanities, Social Sciences, Business Studies, Law, and Life & Earth Sciences.
            </p>
          )}
        </section>
      </FadeIn>

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
      <FadeIn delay={0.3} direction="up">
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-foreground">Campus Information</h2>
          {uni?.campusInfo ? (
            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: uni.campusInfo }} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard title="Location" value="Barishal Sadar, Barishal, Bangladesh" icon={<MapPin className="h-4 w-4" />} />
              <InfoCard title="Type" value="Public University" icon={<GraduationCap className="h-4 w-4" />} />
              <InfoCard title="Faculties" value="6 Faculties, 30+ Departments" icon={<BookOpen className="h-4 w-4" />} />
              <InfoCard title="Contact" value={uni?.contactInfo || 'info@barisaluniv.edu.bd'} icon={<Phone className="h-4 w-4" />} />
            </div>
          )}
        </section>
      </FadeIn>

      {/* Admission Info */}
      {uni?.admissionInfo && (
        <FadeIn delay={0.4} direction="up">
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3 text-foreground">Admission Information</h2>
            <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: uni.admissionInfo }} />
          </section>
        </FadeIn>
      )}

      {/* Map placeholder */}
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
    </div>
  );
}

function InfoCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div
      className="border rounded-lg p-4 bg-card"
    >
      <div className="flex items-center gap-2 text-primary mb-1">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
  );
}
