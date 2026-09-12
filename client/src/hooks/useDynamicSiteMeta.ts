import { useEffect } from 'react';
import { useSiteSettings } from './useSiteSettings';

/** Imperatively syncs the document head with SiteSettings once at the app root, so every page gets the favicon and fallback metadata that per-page `<SEO />` cannot provide. */
export function useDynamicSiteMeta() {
  const { settings } = useSiteSettings();

  // Favicon: replace any existing icon links with the settings favicon
  useEffect(() => {
    if (!settings?.favicon) return;

    // Cache-bust so browsers fetch the new favicon on change
    const cacheBust = settings.updatedAt
      ? `?v=${new Date(settings.updatedAt).getTime()}`
      : `?v=${Date.now()}`;
    const href = `${settings.favicon}${cacheBust}`;

    // Remove ALL existing icon links (static + any previously added) to avoid stale ones
    const existing = document.querySelectorAll(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    );
    existing.forEach((el) => el.parentNode?.removeChild(el));

    // Add the new icon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = href;
    // Let the browser infer the type from the URL, Cloudinary serves correct mime
    document.head.appendChild(link);

    // Also add apple-touch-icon for iOS home-screen bookmarks
    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = href;
    document.head.appendChild(appleLink);
  }, [settings?.favicon, settings?.updatedAt]);

  // Title. Use the full site name from settings as the default document title
  // Per-page <SEO /> components still override this when mounted.
  useEffect(() => {
    if (!settings?.siteName) return;
    const fullTitle = settings.siteNameFull
      ? `${settings.siteName} - ${settings.siteNameFull}`
      : settings.siteName;
    document.title = fullTitle;
  }, [settings?.siteName, settings?.siteNameFull]);

  // Meta description: fallback for pages without <SEO />
  useEffect(() => {
    if (!settings?.siteName) return;
    const description = `Official platform of ${settings.siteNameFull || settings.siteName}. Member directory, events, notices, committees, and more.`;

    let metaTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = 'description';
      document.head.appendChild(metaTag);
    }
    metaTag.content = description;
  }, [settings?.siteName, settings?.siteNameFull]);
}
