import { motion } from 'motion/react';
import { Facebook, Youtube, Linkedin, Twitter } from 'lucide-react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

/**
 * Horizontal row of social-media icon links rendered in the footer below
 * the app-download buttons. Reads from `settings.socialLinks` and only
 * shows entries whose URL is configured via `/admin/settings → Social Links`.
 */

type SocialDef = {
  key: 'facebook' | 'youtube' | 'linkedin' | 'twitter';
  href: string | undefined;
  label: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

export default function SocialIcons() {
  const { settings } = useSiteSettings();
  const sl = settings?.socialLinks;

  const items: SocialDef[] = [
    { key: 'facebook', href: sl?.facebook, label: 'Facebook', Icon: Facebook },
    { key: 'youtube', href: sl?.youtube, label: 'YouTube', Icon: Youtube },
    { key: 'linkedin', href: sl?.linkedin, label: 'LinkedIn', Icon: Linkedin },
    { key: 'twitter', href: sl?.twitter, label: 'Twitter / X', Icon: Twitter },
  ];

  const visible = items.filter((i) => !!i.href?.trim());
  if (visible.length === 0) return null;

  return (
    <div className="mt-4 flex items-center gap-2">
      {visible.map(({ key, href, label, Icon }) => (
        <motion.a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          aria-label={label}
          className="
            grid place-items-center leading-none
            h-9 w-9 rounded-full
            border border-primary text-primary
            bg-white dark:bg-background
            hover:bg-primary hover:text-primary-foreground
            transition-colors
          "
        >
          <Icon className="h-4 w-4 block" />
        </motion.a>
      ))}
    </div>
  );
}
