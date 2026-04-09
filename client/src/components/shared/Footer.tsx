import { Link } from 'react-router-dom';
import { FadeIn, GradientText } from '@/components/reactbits';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useThemeStore } from '@/stores/themeStore';

export default function Footer() {
  const { settings } = useSiteSettings();
  const { theme } = useThemeStore();
  const fLogo = theme === 'dark' ? (settings?.footerLogoDark || settings?.footerLogo) : settings?.footerLogo;
  const siteName = settings?.siteName || 'RDSWA';

  return (
    <footer role="contentinfo" className="border-t bg-background">
      <div className="container mx-auto py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <FadeIn delay={0}>
            <div>
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
              <p className="text-sm text-muted-foreground leading-relaxed">
                {settings?.siteNameFull || siteName}
                {settings?.address ? `, ${settings.address}` : ''}
              </p>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors">About Us</Link></li>
                <li><Link to="/committee" className="hover:text-foreground transition-colors">Committee</Link></li>
                <li><Link to="/events" className="hover:text-foreground transition-colors">Events</Link></li>
                <li><Link to="/notices" className="hover:text-foreground transition-colors">Notices</Link></li>
              </ul>
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link to="/bus-schedule" className="hover:text-foreground transition-colors">Bus Schedule</Link></li>
                <li><Link to="/gallery" className="hover:text-foreground transition-colors">Gallery</Link></li>
                <li><Link to="/donations" className="hover:text-foreground transition-colors">Donations</Link></li>
                <li><Link to="/documents" className="hover:text-foreground transition-colors">Documents</Link></li>
              </ul>
            </div>
          </FadeIn>
          <FadeIn delay={0.3}>
            <div>
              <h4 className="font-semibold mb-4">Legal & Help</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link></li>
                <li><Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                {settings?.universityInfo?.name && <li className="pt-1 text-xs">{settings.universityInfo.name}</li>}
              </ul>
            </div>
          </FadeIn>
        </div>
        <FadeIn>
          <div className="mt-10 pt-6 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</span>
            <span className="text-xs">Developed by <a href="https://github.com/jfemon8" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline underline-offset-2">Emon</a></span>
          </div>
        </FadeIn>
      </div>
    </footer>
  );
}
