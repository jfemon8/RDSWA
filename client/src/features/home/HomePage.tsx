import { Link } from 'react-router-dom';
import { ArrowRight, Users, Calendar, Bell, Heart, GraduationCap, Droplets, MapPin, Vote } from 'lucide-react';
import { BlurText, GradientText, CountUp, RotatingText, SpotlightCard, FadeIn, ShinyText } from '@/components/reactbits';
import { motion } from 'motion/react';

export default function HomePage() {
  return (
    <div className="overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center py-20 md:py-32">
        {/* Animated background gradient blobs */}
        <div className="absolute inset-0 overflow-hidden -z-10">
          <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse [animation-delay:2s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[80px]" />
        </div>

        <div className="container mx-auto px-4 text-center">
          <FadeIn direction="down" delay={0.1}>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <ShinyText
                text="Welcome to RDSWA"
                speed={3}
                className="text-sm font-medium"
                color="hsl(var(--primary))"
                shineColor="hsl(var(--primary-foreground))"
              />
            </div>
          </FadeIn>

          <BlurText
            text="Rangpur Divisional Student"
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-2 justify-center"
            delay={100}
            animateBy="words"
            direction="bottom"
          />

          <div className="flex items-center justify-center mb-6">
            <GradientText
              colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
              animationSpeed={4}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight"
            >
              Welfare Association
            </GradientText>
          </div>

          <FadeIn delay={0.6} blur>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              Connecting students from Rangpur Division at Barishal University.
            </p>
          </FadeIn>

          <FadeIn delay={0.8}>
            <div className="flex items-center justify-center gap-2 text-lg md:text-xl text-muted-foreground mb-10">
              <span>Building</span>
              <RotatingText
                texts={['Community', 'Friendships', 'Success', 'Unity', 'Future']}
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
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/register"
                  className="inline-flex items-center bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
                >
                  Join RDSWA <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                <Link
                  to="/about"
                  className="inline-flex items-center border border-border px-8 py-3.5 rounded-xl font-semibold hover:bg-accent transition-all"
                >
                  Learn More
                </Link>
              </motion.div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: 'Active Members', value: 500, suffix: '+', icon: Users },
              { label: 'Events Organized', value: 50, suffix: '+', icon: Calendar },
              { label: 'Districts Connected', value: 8, suffix: '', icon: MapPin },
              { label: 'Years of Service', value: 5, suffix: '+', icon: GraduationCap },
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

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">What We Offer</h2>
          </FadeIn>
          <FadeIn delay={0.15}>
            <p className="text-muted-foreground text-center max-w-xl mx-auto mb-14">
              A comprehensive platform for Rangpur Division students to connect, grow, and support each other.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Users, title: 'Community', description: 'Connect with students from your district and build lasting relationships.', color: 'rgba(59, 130, 246, 0.15)' },
              { icon: Calendar, title: 'Events', description: 'Participate in cultural events, workshops, and social gatherings.', color: 'rgba(139, 92, 246, 0.15)' },
              { icon: Bell, title: 'Notices', description: 'Stay updated with important announcements and university news.', color: 'rgba(236, 72, 153, 0.15)' },
              { icon: Heart, title: 'Welfare', description: 'Access welfare programs, mentorship, and alumni networking.', color: 'rgba(34, 197, 94, 0.15)' },
            ].map((feature, i) => (
              <FadeIn key={feature.title} delay={i * 0.1} direction="up" scale>
                <SpotlightCard
                  className="bg-card border-border p-6 h-full"
                  spotlightColor={feature.color}
                >
                  <motion.div
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </motion.div>
                </SpotlightCard>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-14">Everything You Need</h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Droplets, title: 'Blood Donors', description: 'Find blood donors from your community in emergencies.', link: '/blood-donors' },
              { icon: Vote, title: 'Voting & Polls', description: 'Participate in democratic decisions and committee elections.', link: '/voting' },
              { icon: MapPin, title: 'Bus Schedule', description: 'University and inter-city bus schedules at your fingertips.', link: '/bus-schedule' },
              { icon: GraduationCap, title: 'Alumni Network', description: 'Connect with alumni for mentorship and career guidance.', link: '/members' },
              { icon: Calendar, title: 'Photo Gallery', description: 'Relive memories from events and activities.', link: '/gallery' },
              { icon: Heart, title: 'Donations', description: 'Contribute to welfare funds and support fellow students.', link: '/donations' },
            ].map((service, i) => (
              <FadeIn key={service.title} delay={i * 0.08} direction="up">
                <Link to={service.link}>
                  <motion.div
                    className="group bg-card border rounded-xl p-6 hover:border-primary/50 transition-colors"
                    whileHover={{ y: -6, transition: { type: 'spring', stiffness: 300, damping: 20 } }}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <service.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{service.title}</h3>
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-primary/15 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto px-4 text-center">
          <FadeIn scale blur>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to{' '}
              <GradientText
                colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
                animationSpeed={3}
                className="text-3xl md:text-5xl font-bold"
              >
                Join Us
              </GradientText>
              ?
            </h2>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-10">
              Become a part of the largest Rangpur Division student community at Barishal University.
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
              <Link
                to="/register"
                className="inline-flex items-center bg-primary text-primary-foreground px-10 py-4 rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
              >
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </motion.div>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
