#!/usr/bin/env node
/**
 * Static-route SEO prerender — runs AFTER `vite build`.
 *
 * Why this exists
 * ---------------
 * RDSWA is a client-rendered SPA. Vite emits a single `dist/index.html`
 * with a generic <title>/description, and the live SEO component (powered
 * by react-helmet-async) only swaps those values once the JavaScript bundle
 * has executed. Googlebot honours the JS-rendered metadata on its second
 * pass, but the *initial* HTTP response and every social-share scraper
 * (Facebook, Twitter, LinkedIn, WhatsApp, Slack, Telegram) read the raw
 * HTML — so without per-route HTML, every shared URL renders with the
 * same homepage card and competes for the same canonical signal.
 *
 * What this does
 * --------------
 * For every static public route below, we materialise a route-specific
 * `dist/<path>/index.html` whose <title>, meta description, canonical,
 * Open Graph and Twitter tags, robots directive, and JSON-LD schemas are
 * patched to match what the runtime <SEO> component would render. The
 * client bundle still hydrates on top of this HTML (so the SPA continues
 * to work), but crawlers see the right metadata on first byte.
 *
 * Dynamic routes (event/notice/job detail pages) are intentionally NOT
 * prerendered — their content changes hourly and Mongo data isn't
 * available at build time. The dynamic sitemap surfaces those URLs to
 * crawlers, JSON-LD on the live pages keeps them rich-result eligible,
 * and Google's renderer fills in the rest.
 *
 * Why not vite-plugin-prerender / puppeteer?
 * ------------------------------------------
 * Both require a headless Chromium download (~280 MB) which blows Vercel's
 * build cache budget and adds 30–90s to every deploy. We get 95% of the
 * SEO benefit (correct metadata in the initial response, route-specific
 * canonicals, no SPA-shell duplication) for ~zero install/build cost.
 *
 * Keep this script's metadata in sync with the runtime <SEO> component
 * calls — the source of truth for runtime is each page's <SEO> JSX,
 * mirrored here for the SSR-equivalent tag block.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const SOURCE_HTML = path.join(DIST_DIR, 'index.html');
const SITE_URL = 'https://rdswa.info.bd';
const OG_IMAGE = `${SITE_URL}/og-image.png`;

const ORG_NAME = 'Rangpur Divisional Student Welfare Association';
const ORG_NAME_BN = 'রংপুর বিভাগীয় ছাত্র কল্যাণ সমিতি';
const ORG_ALT = 'RDSWA';
const ORG_LOGO = `${SITE_URL}/icons/icon-512x512.png`;

// ─── Static schemas attached to every prerendered page ────────────────────
const ORG_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  '@id': `${SITE_URL}/#organization`,
  name: ORG_NAME,
  alternateName: [ORG_ALT, ORG_NAME_BN],
  url: SITE_URL,
  logo: ORG_LOGO,
  image: OG_IMAGE,
  description: `Official platform of ${ORG_NAME} at the University of Barishal — connecting students from the Rangpur Division through events, notices, scholarships, blood-donor network, bus schedules, and alumni community.`,
  parentOrganization: {
    '@type': 'CollegeOrUniversity',
    name: 'University of Barishal',
    url: 'https://bu.ac.bd',
  },
  areaServed: [
    { '@type': 'AdministrativeArea', name: 'Rangpur Division, Bangladesh' },
    { '@type': 'AdministrativeArea', name: 'Barishal, Bangladesh' },
  ],
  knowsLanguage: ['en', 'bn'],
};

const WEBSITE_SCHEMA = {
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

function breadcrumb(crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

// ─── Per-route metadata (mirrors the runtime <SEO> calls) ─────────────────
//
// Title format follows the runtime convention: `{title} | RDSWA` for sub-
// pages, raw site-name for the home page. Descriptions are 150–250 chars
// to fit Google's snippet window without truncation.
const ROUTES = [
  {
    path: '/',
    title: 'RDSWA - Rangpur Divisional Student Welfare Association',
    description:
      `RDSWA — ${ORG_NAME} at the University of Barishal. Member directory, events, notices, blood-donor network, Rangpur–Barishal bus schedule, scholarships, committees, alumni, and more for BU Rangpur students. ${ORG_NAME_BN}, বরিশাল বিশ্ববিদ্যালয়।`,
    keywords:
      'RDSWA, Rangpur Divisional Student Welfare Association, University of Barishal, BU Rangpur, রংপুর বিভাগীয় ছাত্র কল্যাণ সমিতি, বরিশাল বিশ্ববিদ্যালয়, Barishal University Rangpur students, Rangpur student association, BU student welfare, Rangpur to Barishal bus, BU blood donor',
    crumbs: [{ name: 'Home', path: '/' }],
  },
  {
    path: '/about',
    title: 'About RDSWA | RDSWA',
    description:
      `About ${ORG_NAME} (RDSWA) at the University of Barishal — our mission, vision, objectives, and history. The official student welfare body for BU students from Rangpur Division. ${ORG_NAME_BN} সম্পর্কে জানুন।`,
    keywords:
      'About RDSWA, Rangpur Divisional Student Welfare Association, RDSWA history, RDSWA mission, University of Barishal student association, BU Rangpur, ববি রংপুর',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about' },
    ],
  },
  {
    path: '/university',
    title: 'University of Barishal | RDSWA',
    description:
      'About the University of Barishal (BU) — overview, history, campus information, departments, faculty, admissions, and campus life. Comprehensive university guide for Rangpur Division students. বরিশাল বিশ্ববিদ্যালয় সম্পর্কে জানুন।',
    keywords:
      'University of Barishal, BU Bangladesh, Barishal University, ববি, বরিশাল বিশ্ববিদ্যালয়, BU admissions, BU departments, BU campus, Bangladesh public university',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'University', path: '/university' },
    ],
  },
  {
    path: '/bus-schedule',
    title: 'Rangpur to Barishal Bus Schedule | RDSWA',
    description:
      'Complete Rangpur to Barishal and Barishal to Rangpur bus schedule for University of Barishal students — operator timings, routes, counters, and seasonal variations updated regularly. RDSWA official transport guide.',
    keywords:
      'Rangpur to Barishal bus, Barishal to Rangpur bus, BU Rangpur bus schedule, University of Barishal transport, ববি বাস, রংপুর বরিশাল বাস, RDSWA bus, intercity bus Bangladesh, bus counter Rangpur Barishal',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Bus Schedule', path: '/bus-schedule' },
    ],
  },
  {
    path: '/notices',
    title: 'Notices & Announcements | RDSWA',
    description:
      'Latest RDSWA notices, announcements, and updates for University of Barishal Rangpur students. Read official statements, exam notices, scholarship announcements, and committee notifications.',
    keywords:
      'RDSWA notices, RDSWA announcements, University of Barishal notice, BU Rangpur notice, ববি নোটিশ, RDSWA নোটিশ, student welfare announcements',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Notices', path: '/notices' },
    ],
  },
  {
    path: '/events',
    title: 'Events | RDSWA',
    description:
      'Upcoming and past RDSWA events at the University of Barishal — workshops, seminars, cultural programs, sports, scholarships, and social gatherings for Rangpur Division students.',
    keywords:
      'RDSWA events, BU events, University of Barishal events, Rangpur student events, RDSWA workshops, RDSWA seminars, ববি ইভেন্ট, RDSWA কর্মসূচি',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Events', path: '/events' },
    ],
  },
  {
    path: '/committee',
    title: 'Committee | RDSWA',
    description:
      'RDSWA committees and leadership team at the University of Barishal — President, General Secretary, Organizing Secretary, Treasurer and full executive lineup of every committee.',
    keywords:
      'RDSWA committee, RDSWA president, RDSWA general secretary, BU Rangpur committee, University of Barishal student committee, ববি কমিটি',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Committee', path: '/committee' },
    ],
  },
  {
    path: '/members',
    title: 'Members | RDSWA',
    description:
      'RDSWA member directory — verified students of the University of Barishal from Rangpur Division. Find members by department, batch, district, and profession.',
    keywords:
      'RDSWA members, BU Rangpur students, University of Barishal student directory, Rangpur students BU, ববি রংপুর শিক্ষার্থী, RDSWA সদস্য',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Members', path: '/members' },
    ],
  },
  {
    path: '/alumni',
    title: 'Honorable Alumnis | RDSWA',
    description:
      'RDSWA alumni network — graduates of the University of Barishal from Rangpur Division. Find ex-students by batch, department, district, and current profession.',
    keywords:
      'RDSWA alumni, BU Rangpur alumni, University of Barishal alumni, RDSWA প্রাক্তন শিক্ষার্থী, ববি প্রাক্তন',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Alumni', path: '/alumni' },
    ],
  },
  {
    path: '/advisors',
    title: 'Honorable Advisors | RDSWA',
    description:
      'RDSWA Advisors at the University of Barishal — former committee leaders and appointed advisors guiding the Rangpur Divisional Student Welfare Association.',
    keywords: 'RDSWA advisors, RDSWA উপদেষ্টা, BU Rangpur advisors',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Advisors', path: '/advisors' },
    ],
  },
  {
    path: '/senior-advisors',
    title: 'Honorable Senior Advisors | RDSWA',
    description:
      'RDSWA Senior Advisors at the University of Barishal — senior mentors appointed to guide the Rangpur Divisional Student Welfare Association.',
    keywords: 'RDSWA senior advisors, RDSWA সিনিয়র উপদেষ্টা',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Senior Advisors', path: '/senior-advisors' },
    ],
  },
  {
    path: '/blood-donors',
    title: 'Blood Donor List — University of Barishal Rangpur Students | RDSWA',
    description:
      'Find verified blood donors from RDSWA — students of the University of Barishal from Rangpur Division. Filter by blood group (A+, A−, B+, B−, AB+, AB−, O+, O−) and district.',
    keywords:
      'blood donor list Bangladesh, blood donor Barishal, blood donor Rangpur, BU blood donor, ববি ব্লাড ডোনার, রক্তদাতা, emergency blood Bangladesh, A+ blood donor, B+ blood donor, O+ blood donor, RDSWA blood',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Blood Donors', path: '/blood-donors' },
    ],
  },
  {
    path: '/gallery',
    title: 'Gallery | RDSWA',
    description:
      'RDSWA photo gallery — events, cultural programs, sports, social gatherings, and memorable moments of Rangpur Division students at the University of Barishal.',
    keywords: 'RDSWA gallery, RDSWA photos, BU Rangpur photos, RDSWA গ্যালারি',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Gallery', path: '/gallery' },
    ],
  },
  {
    path: '/documents',
    title: 'Documents | RDSWA',
    description:
      'Official RDSWA documents — constitution, policies, meeting resolutions, financial reports, membership forms, and downloadable resources.',
    keywords: 'RDSWA documents, RDSWA constitution, RDSWA policies, RDSWA membership form, RDSWA ডকুমেন্ট',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Documents', path: '/documents' },
    ],
  },
  {
    path: '/donations',
    title: 'Donations | RDSWA',
    description:
      'Support RDSWA — donate to active scholarship, emergency-aid, and student-welfare campaigns at the University of Barishal.',
    keywords: 'RDSWA donation, donate to RDSWA, BU student scholarship, Rangpur student fund, RDSWA দান',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Donations', path: '/donations' },
    ],
  },
  {
    path: '/voting',
    title: 'Voting & Polls | RDSWA',
    description:
      'Participate in RDSWA polls, elections, and community decisions at the University of Barishal.',
    keywords: 'RDSWA voting, RDSWA elections, BU student elections, RDSWA নির্বাচন',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Voting', path: '/voting' },
    ],
  },
  {
    path: '/contact',
    title: 'Contact Us | RDSWA',
    description:
      `Get in touch with the ${ORG_NAME} (RDSWA) at the University of Barishal — email, phone, social media, and official feedback form.`,
    keywords: 'contact RDSWA, RDSWA email, RDSWA phone, RDSWA যোগাযোগ',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Contact', path: '/contact' },
    ],
  },
  {
    path: '/faq',
    title: 'FAQ | RDSWA',
    description: 'Frequently asked questions about RDSWA membership, services, and the platform.',
    keywords: 'RDSWA FAQ, RDSWA membership help, RDSWA সাহায্য',
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'FAQ', path: '/faq' },
    ],
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | RDSWA',
    description:
      'RDSWA privacy policy — how we collect, use, and protect your personal information.',
    keywords: 'RDSWA privacy policy, RDSWA গোপনীয়তা',
    noindex: true,
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Privacy', path: '/privacy' },
    ],
  },
  {
    path: '/terms',
    title: 'Terms & Conditions | RDSWA',
    description: 'Terms and conditions for using the RDSWA platform.',
    keywords: 'RDSWA terms, RDSWA শর্তাবলী',
    noindex: true,
    crumbs: [
      { name: 'Home', path: '/' },
      { name: 'Terms', path: '/terms' },
    ],
  },
];

function htmlEscape(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildHeadInjection(route) {
  const url = `${SITE_URL}${route.path}`;
  const description = htmlEscape(route.description);
  const title = htmlEscape(route.title);
  const keywords = route.keywords ? htmlEscape(route.keywords) : '';

  const tags = [];
  // Per-route description + canonical + robots come AFTER the static
  // index.html ones so the patched value wins. We replace the document's
  // static <title> earlier in `patchHtml`, not here, because there's only
  // one valid <title> per page.
  if (route.noindex) tags.push('<meta name="robots" content="noindex,nofollow" />');
  tags.push(`<link rel="canonical" href="${url}" />`);
  if (keywords) tags.push(`<meta name="keywords" content="${keywords}" />`);

  // Refresh OG/Twitter to per-route values. The static ones in index.html
  // are matched and replaced by patchHtml; what we add here is everything
  // that wasn't in the base.
  tags.push(`<meta property="og:url" content="${url}" />`);
  tags.push('<meta property="og:image:width" content="1200" />');
  tags.push('<meta property="og:image:height" content="630" />');
  tags.push('<meta property="og:locale" content="en_US" />');
  tags.push('<meta property="og:locale:alternate" content="bn_BD" />');

  // Schemas — Organization, WebSite, BreadcrumbList. These are emitted on
  // top of any JSON-LD a runtime <SEO> may inject; react-helmet-async
  // dedupes by content so duplicates collapse cleanly.
  const schemas = [ORG_SCHEMA, WEBSITE_SCHEMA, breadcrumb(route.crumbs)];
  for (const s of schemas) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(s)}</script>`);
  }

  return { headTags: tags.join('\n    '), title, description, url };
}

function patchHtml(html, route) {
  const { headTags, title, description, url } = buildHeadInjection(route);

  // Replace <title>
  let out = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);

  // Replace meta description
  out = out.replace(
    /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="description" content="${description}" />`,
  );

  // Replace OG title / description / image / url already present in
  // index.html so the route-specific values win.
  out = out.replace(
    /<meta\s+property=["']og:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:title" content="${title}" />`,
  );
  out = out.replace(
    /<meta\s+property=["']og:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:description" content="${description}" />`,
  );
  out = out.replace(
    /<meta\s+property=["']og:image["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
  );

  // Twitter
  out = out.replace(
    /<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:title" content="${title}" />`,
  );
  out = out.replace(
    /<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:description" content="${description}" />`,
  );
  out = out.replace(
    /<meta\s+name=["']twitter:image["']\s+content=["'][^"']*["']\s*\/?>/i,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
  );

  // Inject the additive head tags right before </head>. The placement
  // matters for canonical/robots — those need to appear BEFORE the JS
  // bundle injects react-helmet's runtime tags so social scrapers (which
  // don't run JS) read them first. We piggyback on the closing </head>
  // tag rather than the opening so we land at the very end of <head>,
  // after the existing static metas.
  out = out.replace('</head>', `    ${headTags}\n  </head>`);

  // Mark this HTML as being prerendered for the route so debugging is
  // easy and so future build steps (e.g. revalidation tooling) can detect
  // that this is not the raw index.html.
  out = out.replace(
    '<html ',
    `<html data-prerendered-route="${url}" `,
  );

  return out;
}

async function main() {
  const baseHtml = await readFile(SOURCE_HTML, 'utf-8');
  console.log(`Prerendering ${ROUTES.length} static routes →`);

  for (const route of ROUTES) {
    const html = patchHtml(baseHtml, route);

    // Path "/" stays at dist/index.html (overwrite the source). All other
    // paths become dist/<segment>/index.html — Vercel serves them via its
    // automatic directory-index resolution before the SPA fallback.
    const outPath =
      route.path === '/'
        ? path.join(DIST_DIR, 'index.html')
        : path.join(DIST_DIR, route.path.replace(/^\//, ''), 'index.html');

    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, html, 'utf-8');
    console.log(`  ✓ ${path.relative(DIST_DIR, outPath)}`);
  }

  console.log(`Done — ${ROUTES.length} routes prerendered.`);
}

main().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
