import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search, Mail, Users, Calendar, FileText, Image, Bus } from 'lucide-react';
import { motion } from 'motion/react';
import { FadeIn, GradientText } from '@/components/reactbits';
import SEO from '@/components/SEO';

const popularLinks = [
  { to: '/about', label: 'About', icon: FileText },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/events', label: 'Events', icon: Calendar },
  { to: '/notices', label: 'Notices', icon: FileText },
  { to: '/gallery', label: 'Gallery', icon: Image },
  { to: '/bus-schedule', label: 'Bus Schedule', icon: Bus },
  { to: '/contact', label: 'Contact', icon: Mail },
  { to: '/faq', label: 'FAQ', icon: Search },
];

export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-10 md:py-16 flex items-center justify-center">
      <SEO title="Page Not Found" description="The page you're looking for doesn't exist." />
      <div className="w-full max-w-3xl text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <GradientText
            colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
            animationSpeed={3}
            className="text-7xl sm:text-8xl font-bold mb-4"
          >
            404
          </GradientText>
        </motion.div>

        <motion.h2
          className="text-2xl sm:text-3xl font-semibold mb-2 text-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Page Not Found
        </motion.h2>

        <motion.p
          className="text-muted-foreground mb-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          We couldn't find the page you're looking for.
        </motion.p>

        <motion.p
          className="text-xs text-muted-foreground/70 mb-8 break-all"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <code className="px-2 py-1 rounded bg-muted">{location.pathname}</code>
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-3 justify-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 border rounded-xl hover:bg-accent text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </motion.button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 text-sm font-semibold shadow-lg shadow-primary/20 transition-colors"
          >
            <Home className="h-4 w-4" /> Go Home
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 border rounded-xl hover:bg-accent text-sm font-semibold transition-colors"
          >
            <Mail className="h-4 w-4" /> Contact Us
          </Link>
        </motion.div>

        <FadeIn direction="up" delay={0.5}>
          <div className="border-t pt-8">
            <p className="text-sm text-muted-foreground mb-4">Or try one of these popular pages:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {popularLinks.map((link, i) => {
                const Icon = link.icon;
                return (
                  <motion.div
                    key={link.to}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 + i * 0.04 }}
                  >
                    <Link
                      to={link.to}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border hover:border-primary hover:bg-primary/5 hover:text-primary transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium">{link.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
