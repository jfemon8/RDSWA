import { Link } from 'react-router-dom';
import { ArrowRight, Users, Calendar, Bell, Heart } from 'lucide-react';

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 py-20 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Rangpur Divisional Student
            <br />
            <span className="text-primary">Welfare Association</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Connecting students from Rangpur Division at Barishal University.
            Building community, fostering growth, and supporting each other.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center bg-primary text-primary-foreground px-6 py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Join RDSWA <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center border border-border px-6 py-3 rounded-lg font-semibold hover:bg-accent transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">What We Offer</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="Community"
              description="Connect with students from your district and build lasting relationships."
            />
            <FeatureCard
              icon={<Calendar className="h-8 w-8" />}
              title="Events"
              description="Participate in cultural events, workshops, and social gatherings."
            />
            <FeatureCard
              icon={<Bell className="h-8 w-8" />}
              title="Notices"
              description="Stay updated with important announcements and university news."
            />
            <FeatureCard
              icon={<Heart className="h-8 w-8" />}
              title="Support"
              description="Access welfare programs, mentorship, and alumni networking."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-background p-6 rounded-lg border hover:shadow-md transition-shadow">
      <div className="text-primary mb-4">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
