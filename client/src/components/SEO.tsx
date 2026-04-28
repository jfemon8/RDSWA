import { Helmet } from 'react-helmet-async';
import { useSiteSettings } from '@/hooks/useSiteSettings';

// Canonical production origin. Falls back to window.location.origin at
// runtime so preview/staging deployments still render valid (origin-correct)
// canonical/og:url tags — but the production origin is the source of truth
// for indexed canonicals so search engines never split rank between
// rdswa.info.bd and a Vercel preview URL.
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
  // All of the following are OPTIONAL and have safe defaults — existing
  // call sites that only pass title/description/image continue to behave
  // exactly as before. New callers can opt in to the richer signals.

  /**
   * Explicit canonical URL. When omitted, the canonical is derived from
   * the production origin + current pathname so duplicate-content risk is
   * eliminated for every page that mounts <SEO> (mirrors Google's
   * recommendation that every indexable page declare a self-canonical).
   */
  canonical?: string;

  /** Comma-separated meta keywords. Optional — Google ignores it but other
   *  crawlers (Yandex, Baidu, niche search) still weight it. */
  keywords?: string;

  /** When true, emits <meta name="robots" content="noindex,nofollow"> so
   *  the page is excluded from search indexes. Use on auth/legal pages
   *  that should never rank. */
  noindex?: boolean;

  /** BCP-47 locale for og:locale (e.g. "en_US", "bn_BD"). Default "en_US". */
  locale?: string;

  /** hreflang alternates for the same page in other languages. Each
   *  entry produces a <link rel="alternate" hreflang="..." href="..." />.
   *  Pair an "x-default" entry with the actual language entries so search
   *  engines can serve the right version per region. */
  alternates?: AlternateLocale[];

  /** One or more JSON-LD structured-data objects. Each is emitted as a
   *  separate <script type="application/ld+json"> tag. Pages can stack
   *  multiple schemas (e.g. an Article page can also emit BreadcrumbList
   *  alongside the primary Article entity). */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function resolveCanonical(explicit: string | undefined): string {
  if (explicit) return explicit;
  // At runtime, prefer the actual pathname so query-less URLs canonicalise
  // correctly (we deliberately drop search params — they're not part of
  // the canonical identity for our routes). At build/prerender time, fall
  // back to the production root.
  if (typeof window !== 'undefined' && window.location?.pathname) {
    return `${PRODUCTION_ORIGIN}${window.location.pathname}`;
  }
  return PRODUCTION_ORIGIN;
}

function resolveImage(image: string): string {
  // OG image URLs MUST be absolute for Facebook/Twitter scrapers — relative
  // paths get silently dropped by Facebook's debugger. If a caller passes
  // a relative path (e.g. "/og-image.png") we promote it to an absolute
  // URL using the production origin.
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

  // Note: favicon is managed globally by useDynamicSiteMeta at the app root so it works
  // on every page, not just pages that mount <SEO />. Don't set it here.

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
