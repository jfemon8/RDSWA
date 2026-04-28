/**
 * Pure JSON-LD schema builders for RDSWA.
 *
 * Each function returns a plain object suitable for passing to <SEO jsonLd={...}>.
 * Keeping the builders pure (no React, no hooks) means schemas can be composed
 * server-side at prerender time, unit-tested in isolation, and reused across
 * different mount points without coupling to component lifecycles.
 *
 * Schema reference: schema.org/EducationalOrganization, schema.org/Event,
 * schema.org/Article, schema.org/BreadcrumbList, schema.org/WebSite,
 * schema.org/JobPosting.
 */

const SITE_URL = 'https://rdswa.info.bd';
const ORG_NAME = 'Rangpur Divisional Student Welfare Association';
const ORG_NAME_BN = 'রংপুর বিভাগীয় ছাত্র কল্যাণ সমিতি';
const ORG_ALT = 'RDSWA';
const ORG_LOGO = `${SITE_URL}/icons/icon-512x512.png`;
const ORG_OG = `${SITE_URL}/og-image.png`;
const PARENT_UNI = 'University of Barishal';

export function absUrl(path: string): string {
  if (!path) return SITE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Top-level Organization schema describing RDSWA. Mounted once at the
 * layout root so every page advertises the same canonical entity (helps
 * Knowledge Graph attribution and avoids the "multiple Organization
 * candidates" warning in Rich Results Test).
 *
 * We use `EducationalOrganization` rather than the generic `Organization`
 * because RDSWA is a student welfare body affiliated with a university —
 * Google rewards the more specific type with better academic-context
 * surfacing.
 */
export function buildOrganizationSchema(opts?: {
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  socialLinks?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': `${SITE_URL}/#organization`,
    name: ORG_NAME,
    alternateName: [ORG_ALT, ORG_NAME_BN],
    url: SITE_URL,
    logo: ORG_LOGO,
    image: ORG_OG,
    description:
      opts?.description ||
      'Official platform of Rangpur Divisional Student Welfare Association at the University of Barishal — connecting students from the Rangpur division through events, notices, scholarships, blood donor network, bus schedules, and alumni community.',
    parentOrganization: {
      '@type': 'CollegeOrUniversity',
      name: PARENT_UNI,
      url: 'https://bu.ac.bd',
    },
    areaServed: [
      { '@type': 'AdministrativeArea', name: 'Rangpur Division, Bangladesh' },
      { '@type': 'AdministrativeArea', name: 'Barishal, Bangladesh' },
    ],
    knowsLanguage: ['en', 'bn'],
    ...(opts?.email && {
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: opts.email,
        ...(opts.phone && { telephone: opts.phone }),
        availableLanguage: ['English', 'Bengali'],
      },
    }),
    ...(opts?.address && {
      address: {
        '@type': 'PostalAddress',
        addressLocality: opts.address,
        addressCountry: 'BD',
      },
    }),
    ...(opts?.socialLinks?.length && { sameAs: opts.socialLinks }),
  };
}

/**
 * WebSite schema with a SearchAction — tells Google how to deep-link search
 * results into our internal search. Recognised by Google for the "Sitelinks
 * search box" rich result on branded queries (e.g. searching "RDSWA" shows
 * a search box right in the SERP).
 */
export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: ORG_NAME,
    alternateName: ORG_ALT,
    inLanguage: ['en', 'bn'],
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/members?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

interface EventInput {
  id: string;
  title: string;
  description?: string;
  startsAt: string | Date;
  endsAt?: string | Date;
  location?: string;
  coverImage?: string;
  isOnline?: boolean;
  url?: string;
}

/**
 * Event schema — eligible for the Google "Events" rich result (calendar
 * carousel + event detail card). Required fields per Google's docs:
 * `name`, `startDate`, and `location` (or virtual location for online).
 */
export function buildEventSchema(event: EventInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': absUrl(`/events/${event.id}#event`),
    name: event.title,
    description: event.description,
    startDate: new Date(event.startsAt).toISOString(),
    ...(event.endsAt && { endDate: new Date(event.endsAt).toISOString() }),
    eventAttendanceMode: event.isOnline
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: event.isOnline
      ? {
          '@type': 'VirtualLocation',
          url: event.url || absUrl(`/events/${event.id}`),
        }
      : {
          '@type': 'Place',
          name: event.location || 'University of Barishal',
          address: {
            '@type': 'PostalAddress',
            addressLocality: event.location || 'Barishal',
            addressCountry: 'BD',
          },
        },
    ...(event.coverImage && { image: event.coverImage }),
    organizer: { '@id': `${SITE_URL}/#organization` },
    url: absUrl(`/events/${event.id}`),
    isAccessibleForFree: true,
  };
}

interface ArticleInput {
  id: string;
  title: string;
  description?: string;
  body?: string;
  publishedAt: string | Date;
  updatedAt?: string | Date;
  authorName?: string;
  image?: string;
  url: string;
}

/**
 * Article schema — used on Notice detail and Job detail pages. Eligible
 * for the Google News / Top Stories carousel when paired with Article
 * Structured Data signals (date, author, image).
 */
export function buildArticleSchema(article: ArticleInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${absUrl(article.url)}#article`,
    headline: article.title,
    description: article.description || article.title,
    datePublished: new Date(article.publishedAt).toISOString(),
    dateModified: new Date(article.updatedAt || article.publishedAt).toISOString(),
    author: {
      '@type': 'Organization',
      name: article.authorName || ORG_NAME,
      url: SITE_URL,
    },
    publisher: { '@id': `${SITE_URL}/#organization` },
    image: article.image || ORG_OG,
    url: absUrl(article.url),
    mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl(article.url) },
    inLanguage: ['en', 'bn'],
  };
}

interface JobInput {
  id: string;
  title: string;
  description?: string;
  postedAt: string | Date;
  validThrough?: string | Date;
  employerName?: string;
  location?: string;
  employmentType?: string; // FULL_TIME | PART_TIME | INTERN | CONTRACTOR
  url: string;
}

/**
 * JobPosting schema — eligible for Google Jobs (the dedicated jobs box on
 * "[role] jobs in [city]" queries). Strict required fields: `title`,
 * `description`, `datePosted`, `hiringOrganization`, `jobLocation`.
 */
export function buildJobPostingSchema(job: JobInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    '@id': `${absUrl(job.url)}#jobposting`,
    title: job.title,
    description: job.description || job.title,
    datePosted: new Date(job.postedAt).toISOString(),
    ...(job.validThrough && {
      validThrough: new Date(job.validThrough).toISOString(),
    }),
    employmentType: job.employmentType || 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.employerName || ORG_NAME,
      sameAs: SITE_URL,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location || 'Barishal',
        addressCountry: 'BD',
      },
    },
    url: absUrl(job.url),
  };
}

interface BreadcrumbCrumb {
  name: string;
  url: string;
}

/**
 * BreadcrumbList — produces the breadcrumb trail shown above the page
 * title in Google SERPs (replaces the raw URL with named hops).
 */
export function buildBreadcrumbSchema(crumbs: BreadcrumbCrumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: absUrl(crumb.url),
    })),
  };
}

/**
 * Generic ItemList — used on the directory pages (Members, Alumni,
 * Advisors, Blood Donors, Committee). Helps Google understand that the
 * page is a curated list, which can surface the SiteLinks "list" rich
 * result on branded queries.
 */
export function buildItemListSchema(opts: {
  name: string;
  description?: string;
  items: Array<{ name: string; url?: string }>;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${absUrl(opts.url)}#list`,
    name: opts.name,
    description: opts.description,
    numberOfItems: opts.items.length,
    itemListElement: opts.items.slice(0, 50).map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.url && { url: absUrl(item.url) }),
    })),
  };
}
