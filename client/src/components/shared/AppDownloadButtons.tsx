import { motion } from 'motion/react';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import {
  AndroidIcon,
  AppleIcon,
  WindowsIcon,
  LinuxIcon,
} from '@/components/icons/PlatformIcons';

/** Footer stack of identically sized app-download buttons, showing only configured links and tracking the brand palette via CSS variables. */

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
    { key: 'android', href: sl?.androidApp, label: 'Android App', Icon: AndroidIcon },
    { key: 'ios', href: sl?.iosApp, label: 'iOS App', Icon: AppleIcon },
    { key: 'windows', href: sl?.windowsApp, label: 'Windows App', Icon: WindowsIcon },
    { key: 'macos', href: sl?.macosApp, label: 'macOS App', Icon: AppleIcon },
    { key: 'linux', href: sl?.linuxApp, label: 'Linux App', Icon: LinuxIcon },
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
          // The button stays anchored on hover while the background fills and a conic-gradient streak orbits the border.
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
