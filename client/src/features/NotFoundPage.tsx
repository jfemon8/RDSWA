import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { motion } from 'motion/react';
import { GradientText } from '@/components/reactbits';

export default function NotFoundPage() {
  return (
    <div className="container mx-auto min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <GradientText
            colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
            animationSpeed={3}
            className="text-8xl font-bold mb-4"
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
          className="text-muted-foreground mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          The page you're looking for doesn't exist or has been moved.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Link to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 text-sm font-semibold shadow-lg shadow-primary/20">
            <Home className="h-4 w-4" /> Go Home
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
