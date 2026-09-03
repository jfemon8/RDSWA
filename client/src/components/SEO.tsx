import { Helmet } from 'react-helmet-async';
import { useSiteSettings } from '@/hooks/useSiteSettings';

// Canonical production origin, falling back to window.location.origin so previews still emit an origin-correct canonical.
const PRODUCTION_ORIGIN = 'https://rdswa.info.bd';

interface AlternateLocale {
  /** BCP-47 lang code (e.g. "en", "bn") or "x-default". */
  hreflang: string;
  /** Absolute URL of the alternate version. */
  href: string;
}

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;

  // ---- Additive SEO controls ----------------------------------------------
  // All optional with safe defaults, so existing call sites behave exactly as before.

  /** Explicit canonical URL, defaulting to the production origin plus the current pathname. */
  canonical?: string;

  /** Comma-separated meta keywords, ignored by Google but still weighted by some crawlers. */
  keywords?: string;

  /** Emits a noindex,nofollow robots tag for auth and legal pages that should never rank. */
  noindex?: boolean;

  /** BCP-47 locale for og:locale, defaulting to "en_US". */
  locale?: string;

  /** hreflang alternates for this page in other languages, ideally including an "x-default" entry. */
  alternates?: AlternateLocale[];

  /** One or more JSON-LD objects, each emitted as its own script tag so pages can stack schemas. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function resolveCanonical(explicit: string | undefined): string {
  if (explicit) return explicit;
  // Prefer the runtime pathname and drop search params, falling back to the production root at prerender time.
  if (typeof window !== 'undefined' && window.location?.pathname) {
    return `${PRODUCTION_ORIGIN}${window.location.pathname}`;
  }
  return PRODUCTION_ORIGIN;
}

function resolveImage(image: string): string {
  // Facebook and Twitter silently drop relative OG images, so a relative path is promoted to an absolute URL.
  if (!image) return `${PRODUCTION_ORIGIN}/og-image.png`;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${PRODUCTION_ORIGIN}${image.startsWith('/') ? '' : '/'}${image}`;
}

export default function SEO({
  title,
  description,
  image = '/og-image.png',
  url,
  type = 'website',
  canonical,
  keywords,
  noindex = false,
  locale = 'en_US',
  alternates,
  jsonLd,
}: SEOProps) {
  const { settings } = useSiteSettings();
  const siteName = settings?.siteName || 'RDSWA';
  const fullSiteName = settings?.siteNameFull ? `${siteName} - ${settings.siteNameFull}` : siteName;
  const pageTitle = title ? `${title} | ${siteName}` : fullSiteName;
  const desc =
    description ||
    `Official platform of ${settings?.siteNameFull || siteName}. Member directory, events, notices, committees, and more.`;

  const canonicalUrl = resolveCanonical(canonical);
  const ogUrl = url || canonicalUrl;
  const ogImage = resolveImage(image);

  const jsonLdArray = jsonLd
    ? Array.isArray(jsonLd) ? jsonLd : [jsonLd]
    : [];

  // Favicon is managed globally by useDynamicSiteMeta so it works on pages that never mount <SEO />.

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={desc} />
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Robots — only emitted when explicitly opted out, so default
          behaviour (indexable) is preserved for every existing page. */}
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      {/* Canonical — every indexable page self-canonicalises so query
          strings, trailing slashes, and preview-deployment hostnames
          collapse to a single ranked URL. */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />

      {/* hreflang alternates — emitted only when callers opt in by passing
          `alternates`. Pair each language entry with an "x-default" so
          Google can fall back for unmatched locales. */}
      {alternates?.map((alt) => (
        <link key={alt.hreflang} rel="alternate" hrefLang={alt.hreflang} href={alt.href} />
      ))}

      {/* JSON-LD structured data — multiple schemas stack as separate
          <script> tags per Google's recommendation. */}
      {jsonLdArray.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}
