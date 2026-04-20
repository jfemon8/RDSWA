import { Link } from 'react-router-dom';
import { FadeIn, GradientText } from '@/components/reactbits';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useThemeStore } from '@/stores/themeStore';

export default function Footer() {
  const { settings } = useSiteSettings();
  const { theme } = useThemeStore();
  // Fall back to the bundled brand banner (theme-aware) when no custom footer
  // logo is configured.
  const fallbackLogo = theme === 'dark' ? '/icons/logo-dark.png' : '/icons/logo-light.png';
  const fLogo = (theme === 'dark' ? (settings?.footerLogoDark || settings?.footerLogo) : settings?.footerLogo) || fallbackLogo;
  const siteName = settings?.siteName || 'RDSWA';

  // WCAG AA requires 4.5:1 contrast for normal text. text-muted-foreground against
  // bg-background sits near the 4.5:1 boundary in both themes and fails for links/
  // small text. Using foreground with opacity guarantees a stronger base colour
  // while keeping the hover-to-full-opacity affordance.
  const linkClass = 'text-foreground/75 hover:text-foreground transition-colors';
  const textClass = 'text-foreground/80';

  return (
    <footer role="contentinfo" className="border-t bg-background" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="container mx-auto py-10 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          <FadeIn delay={0}>
            <div className="col-span-2 md:col-span-1">
              {fLogo ? (
                <img src={fLogo} alt={siteName} className="h-10 object-contain mb-3" />
              ) : (
                <GradientText
                  colors={['#3b82f6', '#8b5cf6', '#ec4899', '#3b82f6']}
                  animationSpeed={6}
                  className="text-lg font-bold mb-3"
                >
                  {siteName}
                </GradientText>
              )}
              <p className={`text-sm leading-relaxed ${textClass}`}>
                {settings?.siteNameFull || siteName}
                {settings?.address ? `, ${settings.address}` : ''}
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Quick Links</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/about" className={linkClass}>About Us</Link></li>
                <li><Link to="/committee" className={linkClass}>Committee</Link></li>
                <li><Link to="/events" className={linkClass}>Events</Link></li>
                <li><Link to="/notices" className={linkClass}>Notices</Link></li>
              </ul>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Resources</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/bus-schedule" className={linkClass}>Bus Schedule</Link></li>
                <li><Link to="/gallery" className={linkClass}>Gallery</Link></li>
                <li><Link to="/donations" className={linkClass}>Donations</Link></li>
                <li><Link to="/documents" className={linkClass}>Documents</Link></li>
              </ul>
            </div>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal & Help</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/privacy" className={linkClass}>Privacy Policy</Link></li>
                <li><Link to="/terms" className={linkClass}>Terms & Conditions</Link></li>
                <li><Link to="/faq" className={linkClass}>FAQ</Link></li>
                <li><Link to="/contact" className={linkClass}>Contact Us</Link></li>
              </ul>
            </div>
          </FadeIn>
        </div>
        <FadeIn>
          <div className={`mt-8 sm:mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-center sm:text-left ${textClass}`}>
            <span>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</span>
            <span>Developed by <a href="https://github.com/jfemon8" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline underline-offset-2 font-medium">Emon</a></span>
          </div>
        </FadeIn>
      </div>
    </footer>
  );
}
