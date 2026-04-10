import { useEffect } from 'react';
import { useSiteSettings } from './useSiteSettings';

/**
 * Imperatively syncs the document head with dynamic SiteSettings.
 *
 * Runs once at the app root so favicon / title / description update on EVERY page,
 * not just pages that happen to render the <SEO /> component.
 *
 * Why imperative (not Helmet): react-helmet-async is per-page — pages that don't
 * mount <SEO /> never get the override, and the static <link rel="icon"> in
 * index.html wins the race. This hook directly mutates <head> so there's one
 * source of truth regardless of route.
 *
 * Per-page <SEO /> components still work on top of this — they update the title
 * per page, while this hook provides the fallback + dynamic favicon.
 */
export function useDynamicSiteMeta() {
  const { settings } = useSiteSettings();

  // Favicon — replace any existing icon links with the settings favicon
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
    // Let the browser infer the type from the URL — Cloudinary serves correct mime
    document.head.appendChild(link);

    // Also add apple-touch-icon for iOS home-screen bookmarks
    const appleLink = document.createElement('link');
    appleLink.rel = 'apple-touch-icon';
    appleLink.href = href;
    document.head.appendChild(appleLink);
  }, [settings?.favicon, settings?.updatedAt]);

  // Title — use the full site name from settings as the default document title
  // Per-page <SEO /> components still override this when mounted.
  useEffect(() => {
    if (!settings?.siteName) return;
    const fullTitle = settings.siteNameFull
      ? `${settings.siteName} - ${settings.siteNameFull}`
      : settings.siteName;
    document.title = fullTitle;
  }, [settings?.siteName, settings?.siteNameFull]);

  // Meta description — fallback for pages without <SEO />
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
