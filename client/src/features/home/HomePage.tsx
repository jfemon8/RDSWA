import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import { ArrowRight, Users, Calendar, Bell, Heart, GraduationCap, Droplets, MapPin, Vote, FileText, AlertTriangle, Image, Bus } from 'lucide-react';
import { BlurText, GradientText, CountUp, RotatingText, SpotlightCard, FadeIn, ShinyText } from '@/components/reactbits';
import type { LucideIcon } from 'lucide-react';
import SEO from '@/components/SEO';
import { formatDate } from '@/lib/date';
import Promo from '@/components/promo/Promo';

const featureIconMap: Record<string, LucideIcon> = {
  Community: Users, Events: Calendar, Notices: Bell, Welfare: Heart,
};
const serviceIconMap: Record<string, LucideIcon> = {
  'Blood Donors': Droplets, 'Voting & Polls': Vote, 'Bus Schedule': Bus,
  'Alumni Network': GraduationCap, 'Photo Gallery': Image, Donations: Heart,
};
const featureColorMap: Record<string, string> = {
  Community: 'rgba(59, 130, 246, 0.15)', Events: 'rgba(139, 92, 246, 0.15)',
  Notices: 'rgba(236, 72, 153, 0.15)', Welfare: 'rgba(34, 197, 94, 0.15)',
};

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const { data: settingsData } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['settings', 'public-stats'],
    queryFn: async () => {
      const { data } = await api.get('/settings/public-stats');
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: noticesData } = useQuery({
    queryKey: queryKeys.notices.list({ limit: '5' }),
    queryFn: async () => {
      const { data } = await api.get('/notices?limit=5&sort=-publishedAt');
      return data;
    },
  });

  const { data: eventsData } = useQuery({
    queryKey: queryKeys.events.list({ limit: '4', upcoming: 'true' }),
    queryFn: async () => {
      const { data } = await api.get('/events?limit=4&sort=startDate&upcoming=true');
      return data;
    },
  });

  const settings = settingsData?.data;
  const hp = settings?.homePageContent;
  const stats = statsData?.data;
  const notices = noticesData?.data || [];
  const events = eventsData?.data || [];

  const foundedYear = settings?.foundedYear || 2021;
  const yearsOfService = new Date().getFullYear() - foundedYear;

  const features: Array<{ title: string; description: string }> = hp?.features || [];
  const services: Array<{ title: string; description: string; link: string }> = hp?.services || [];
  const rotatingWords: string[] = hp?.rotatingWords || ['Community', 'Friendships', 'Success', 'Unity', 'Future'];

  return (
    <div className="overflow-x-hidden">
      <SEO description="Official platform of RDSWA — connecting students from Rangpur Division at University of Barishal. Events, notices, committees, and more." />
      {/* Hero Section */}
      <section className="relative min-h-[85vh] sm:min-h-[90vh] flex items-center justify-center py-16 sm:py-20 md:py-32">
        <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-48 sm:w-72 h-48 sm:h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-56 sm:w-96 h-56 sm:h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-primary/5 rounded-full blur-[80px]" />
        </div>

        <div className="container mx-auto text-center">
          <FadeIn direction="down" delay={0.1}>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <ShinyText
                text={hp?.heroBadgeText || 'Welcome to RDSWA'}
                speed={3}
                className="text-sm font-medium"
                color="hsl(var(--primary))"
                shineColor="hsl(var(--primary-foreground))"
              />
            </div>
          </FadeIn>

          <BlurText
            text={hp?.heroTitle || 'Rangpur Divisional Student'}
            className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-2 justify-center"
            delay={100}
            animateBy="words"
            direction="bottom"
          />

          <div className="flex items-center justify-center mb-6">
            <GradientText
              colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
              animationSpeed={4}
              className="text-2xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight"
            >
              {hp?.heroTitleGradient || 'Welfare Association'}
            </GradientText>
          </div>

          <FadeIn delay={0.6} blur>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              {hp?.heroSubtitle || 'Connecting students from Rangpur Division at University of Barishal.'}
            </p>
          </FadeIn>

          <FadeIn delay={0.8}>
            <div className="flex items-center justify-center gap-2 text-lg md:text-xl text-muted-foreground mb-10">
              <span>{hp?.heroTagline || 'Building'}</span>
              <RotatingText
                texts={rotatingWords}
                mainClassName="text-primary font-semibold overflow-hidden"
                staggerFrom="last"
                staggerDuration={0.025}
                rotationInterval={2500}
                splitBy="characters"
              />
            </div>
          </FadeIn>

          <FadeIn delay={1.0} scale>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={isAuthenticated ? '/dashboard' : '/register'}
                className="inline-flex items-center bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
              >
                {isAuthenticated ? 'Go to Dashboard' : (hp?.ctaButtonText || 'Get Started')} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center border border-border px-8 py-3.5 rounded-xl font-semibold hover:bg-accent transition-all"
              >
                Learn More
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y bg-muted/30">
        <div className="container mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Active Members', value: stats?.totalMembers || 0, suffix: '+', icon: Users },
              { label: 'Events Organized', value: stats?.totalEvents || 0, suffix: '+', icon: Calendar },
              { label: 'Districts Connected', value: stats?.totalDistricts || 8, suffix: '', icon: MapPin },
              { label: 'Years of Service', value: yearsOfService, suffix: '+', icon: GraduationCap },
            ].map((stat, i) => (
              <FadeIn key={stat.label} delay={i * 0.15} direction="up">
                <div className="text-center">
                  <stat.icon className="h-6 w-6 text-primary mx-auto mb-3" />
                  <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                    <CountUp to={stat.value} duration={2.5} separator="," />
                    <span>{stat.suffix}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Notices Section */}
      {notices.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto">
            <FadeIn>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold">Latest Notices</h2>
                <Link to="/notices" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </FadeIn>
            <div className="space-y-3">
              {notices.map((n: any, i: number) => (
                <FadeIn key={n._id} delay={i * 0.06} direction="left">
                  <Link to={`/notices/${n._id}`}>
                    <div
                      className={`p-4 border rounded-xl bg-card hover:border-primary/30 transition-colors ${
                        n.priority === 'urgent' ? 'border-red-300 dark:border-red-800' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {n.priority === 'urgent' && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <h3 className="font-semibold truncate">{n.title}</h3>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="capitalize">{n.category}</span>
                            <span>{formatDate(n.publishedAt || n.createdAt)}</span>
                          </div>
                        </div>
                        {n.priority !== 'normal' && (
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                            n.priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {n.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Events Section */}
      {events.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto">
            <FadeIn>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-2">
                <h2 className="text-2xl sm:text-3xl font-bold">Upcoming Events</h2>
                <Link to="/events" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </FadeIn>
            <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 gap-6">
              {events.map((e: any, i: number) => (
                <FadeIn key={e._id} delay={i * 0.08} direction="up">
                  <Link to={`/events/${e._id}`}>
                    <div
                      className="group bg-card border rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
                    >
                      {e.coverImage && (
                        <div className="overflow-hidden">
                          <img src={e.coverImage} alt="" className="w-full h-40 object-cover" />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-primary shrink-0" /> {e.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(e.startDate)}
                          </span>
                          {e.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {e.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {features.length > 0 && (
        <section className="py-20">
          <div className="container mx-auto">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">{hp?.featuresHeading || 'What We Offer'}</h2>
            </FadeIn>
            <FadeIn delay={0.15}>
              <p className="text-muted-foreground text-center max-w-xl mx-auto mb-14">
                {hp?.featuresSubheading || 'A comprehensive platform for Rangpur Division students to connect, grow, and support each other.'}
              </p>
            </FadeIn>

            <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, i) => {
                const Icon = featureIconMap[feature.title] || Heart;
                const color = featureColorMap[feature.title] || 'rgba(59, 130, 246, 0.15)';
                return (
                  <FadeIn key={i} delay={i * 0.1} direction="up" scale>
                    <SpotlightCard className="bg-card border-border p-6 h-full" spotlightColor={color}>
                      <div>
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </SpotlightCard>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Services Grid */}
      {services.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto">
            <FadeIn>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-14">{hp?.servicesHeading || 'Everything You Need'}</h2>
            </FadeIn>

            <div className="grid grid-equal grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service, i) => {
                const Icon = serviceIconMap[service.title] || Heart;
                return (
                  <FadeIn key={i} delay={i * 0.08} direction="up">
                    <Link to={service.link}>
                      <div
                        className="group bg-card border rounded-xl p-6 hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{service.title}</h3>
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Promo — multiplex placed just before the CTA so it sits above the
          footer without breaking the hero/CTA composition. Home page is
          flow-based (no main+sidebar grid), so the desktop "sidebar" promo
          requested for richer pages is intentionally not used here — adding
          a floating right-rail would clash with the centered hero. */}
      <section className="container mx-auto py-8">
        <FadeIn direction="up">
          <Promo kind="multiplex" minHeight={300} />
        </FadeIn>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-x-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-primary/15 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto text-center">
          <FadeIn scale blur>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-6">
              {isAuthenticated ? 'Welcome Back to' : 'Ready to'}{' '}
              <GradientText
                colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
                animationSpeed={3}
                className="text-2xl sm:text-3xl md:text-5xl font-bold"
              >
                {isAuthenticated ? 'RDSWA' : (hp?.ctaTitle || 'Join Us')}
              </GradientText>
              {isAuthenticated ? '!' : '?'}
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-10">
              {isAuthenticated
                ? 'Explore your dashboard, connect with members, and stay updated with the community.'
                : (hp?.introText || 'Become a part of the largest Rangpur Division student community at University of Barishal.')
              }
            </p>
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="inline-flex items-center bg-primary text-primary-foreground px-10 py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
            >
              {isAuthenticated ? 'Go to Dashboard' : (hp?.ctaButtonText || 'Get Started')} <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
