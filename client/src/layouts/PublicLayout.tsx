import { Outlet, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import Navbar from '@/components/shared/Navbar';
import Footer from '@/components/shared/Footer';
import BottomNav from '@/components/shared/BottomNav';
import BaseJsonLd from '@/components/seo/BaseJsonLd';
import { motion, AnimatePresence } from 'motion/react';
import Spinner from '@/components/ui/Spinner';
import { useIsAndroidApp } from '@/hooks/usePlatform';

export default function PublicLayout() {
  const location = useLocation();
  const isAndroidApp = useIsAndroidApp();

  return (
    <div className="min-h-screen flex flex-col">
      <BaseJsonLd />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Navbar />
      <main
        id="main-content"
        className={`flex-1 ${isAndroidApp ? 'pb-20' : ''}`}
        role="main"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <Suspense fallback={<Spinner size="md" fullPage />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      {/* Hide footer inside the Android app — bottom nav replaces it for navigation */}
      {!isAndroidApp && <Footer />}
      {isAndroidApp && <BottomNav />}
    </div>
  );
}
