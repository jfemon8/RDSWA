import { motion } from 'motion/react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import {
  PlayStoreIcon,
  AppleIcon,
  WindowsIcon,
  LinuxIcon,
} from '@/components/icons/PlatformIcons';

/**
 * Vertical stack of app-download buttons rendered in the footer.
 * Only buttons whose corresponding link is configured via
 * `/admin/settings → Social Links → App Download Links` are visible.
 *
 * All buttons share identical geometry. Colours resolve to the current
 * brand primary through the `text-primary` + `border-primary` CSS variables,
 * so they track the admin-configured palette automatically.
 */

type ButtonDef = {
  key: 'android' | 'ios' | 'windows' | 'macos' | 'linux';
  href: string | undefined;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

export default function AppDownloadButtons() {
  const { settings } = useSiteSettings();
  const sl = settings?.socialLinks;

  const buttons: ButtonDef[] = [
    { key: 'android', href: sl?.androidApp, label: 'Play Store', Icon: PlayStoreIcon },
    { key: 'ios', href: sl?.iosApp, label: 'App Store', Icon: AppleIcon },
    { key: 'windows', href: sl?.windowsApp, label: 'Microsoft Store', Icon: WindowsIcon },
    { key: 'macos', href: sl?.macosApp, label: 'Mac App Store', Icon: AppleIcon },
    { key: 'linux', href: sl?.linuxApp, label: 'Linux', Icon: LinuxIcon },
  ];

  const visible = buttons.filter((b) => !!b.href?.trim());
  if (visible.length === 0) return null;

  return (
    <div className="mt-5 flex flex-col gap-2">
      {visible.map(({ key, href, label, Icon }) => (
        <motion.a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.98 }}
          // No `whileHover` translation — the button stays anchored.
          // On hover: background fills with primary, text/icon flip to the
          // foreground colour, and a conic-gradient streak orbits the
          // border via .hover-rotating-border (see index.css).
          className="
            flex items-center justify-between gap-3
            bg-white dark:bg-background
            border border-primary text-primary
            rounded-lg px-3.5 py-2
            text-sm font-medium
            hover:bg-primary hover:text-primary-foreground
            transition-colors
            hover-rotating-border
            w-full max-w-[210px]
          "
          aria-label={`Download from ${label}`}
        >
          <span>{label}</span>
          <Icon className="h-5 w-5 shrink-0" />
        </motion.a>
      ))}
    </div>
  );
}
