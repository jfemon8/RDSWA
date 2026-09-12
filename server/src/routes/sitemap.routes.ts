import { Router, Request, Response } from 'express';
import { Event, Notice, JobPost } from '../models';

/** Dynamic sitemap.xml generated per request and CDN-cached for an hour, so new Notices, Events, and Jobs appear without a redeploy. */

const router = Router();

// Production origin that must stay in lock-step with SEO.tsx and robots.txt if it ever changes.
const SITE_URL = 'https://rdswa.info.bd';

interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
  alternates?: Array<{ hreflang: string; href: string }>;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod, changefreq, priority, alternates }: UrlEntry): string {
  const parts: string[] = [];
  parts.push(`  <url>`);
  parts.push(`    <loc>${escapeXml(loc)}</loc>`);
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined) parts.push(`    <priority>${priority.toFixed(1)}</priority>`);
  if (alternates) {
    for (const alt of alternates) {
      parts.push(
        `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`,
      );
    }
  }
  parts.push(`  </url>`);
  return parts.join('\n');
}

// Static public routes whose relative priorities push the acquisition pages up Google's crawl budget.
const STATIC_ROUTES: Array<Omit<UrlEntry, 'loc'> & { path: string }> = [
  { path: '/', changefreq: 'daily', priority: 1.0 },
  { path: '/about', changefreq: 'monthly', priority: 0.9 },
  { path: '/university', changefreq: 'monthly', priority: 0.9 },
  { path: '/bus-schedule', changefreq: 'weekly', priority: 0.95 },
  { path: '/notices', changefreq: 'daily', priority: 0.9 },
  { path: '/events', changefreq: 'daily', priority: 0.9 },
  { path: '/committee', changefreq: 'weekly', priority: 0.85 },
  { path: '/members', changefreq: 'weekly', priority: 0.9 },
  { path: '/alumni', changefreq: 'weekly', priority: 0.85 },
  { path: '/advisors', changefreq: 'monthly', priority: 0.8 },
  { path: '/senior-advisors', changefreq: 'monthly', priority: 0.8 },
  { path: '/blood-donors', changefreq: 'weekly', priority: 0.9 },
  { path: '/gallery', changefreq: 'weekly', priority: 0.7 },
  { path: '/documents', changefreq: 'weekly', priority: 0.7 },
  { path: '/donations', changefreq: 'monthly', priority: 0.7 },
  { path: '/voting', changefreq: 'weekly', priority: 0.6 },
  { path: '/dashboard/jobs', changefreq: 'daily', priority: 0.85 },
  { path: '/contact', changefreq: 'yearly', priority: 0.6 },
  { path: '/faq', changefreq: 'monthly', priority: 0.5 },
  { path: '/privacy', changefreq: 'yearly', priority: 0.3 },
  { path: '/terms', changefreq: 'yearly', priority: 0.3 },
];

router.get('/sitemap.xml', async (_req: Request, res: Response) => {
  try {
    // Select only the fields needed for lastmod and URLs, using `lean()` to skip Mongoose hydration on a hot path.
    const [events, notices, jobs] = await Promise.all([
      Event.find(
        { isDeleted: { $ne: true } },
        { _id: 1, updatedAt: 1, createdAt: 1 },
      )
        .sort({ updatedAt: -1 })
        .limit(500)
        .lean(),
      Notice.find(
        {
          isDeleted: { $ne: true },
          status: { $ne: 'archived' },
          $or: [{ publishedAt: { $lte: new Date() } }, { publishedAt: { $exists: false } }],
        },
        { _id: 1, updatedAt: 1, publishedAt: 1, createdAt: 1 },
      )
        .sort({ updatedAt: -1 })
        .limit(1000)
        .lean(),
      JobPost.find(
        {
          isDeleted: { $ne: true },
          $or: [{ deadline: { $gte: new Date() } }, { deadline: null }, { deadline: { $exists: false } }],
        },
        { _id: 1, updatedAt: 1, createdAt: 1 },
      )
        .sort({ updatedAt: -1 })
        .limit(500)
        .lean(),
    ]);

    const entries: UrlEntry[] = [];

    // Static routes
    for (const r of STATIC_ROUTES) {
      entries.push({
        loc: `${SITE_URL}${r.path}`,
        changefreq: r.changefreq,
        priority: r.priority,
      });
    }

    // Dynamic: events
    for (const e of events) {
      const lastmod = (e.updatedAt || (e as any).createdAt || new Date()).toISOString();
      entries.push({
        loc: `${SITE_URL}/events/${e._id}`,
        lastmod,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }

    // Dynamic: notices
    for (const n of notices) {
      const lastmod = (n.updatedAt || (n as any).publishedAt || (n as any).createdAt || new Date()).toISOString();
      entries.push({
        loc: `${SITE_URL}/notices/${n._id}`,
        lastmod,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }

    // Dynamic: job postings (live ones only: closed jobs are noindex'd
    // client-side too, so we don't waste crawl budget on them).
    for (const j of jobs) {
      const lastmod = (j.updatedAt || (j as any).createdAt || new Date()).toISOString();
      entries.push({
        loc: `${SITE_URL}/dashboard/jobs/${j._id}`,
        lastmod,
        changefreq: 'weekly',
        priority: 0.6,
      });
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(urlEntry).join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    // 1-hour CDN cache + 6h stale-while-revalidate so a crawler burst
    // doesn't pile through to Mongo, but admins still see fresh entries
    // appear within an hour of publishing.
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=21600');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap generation failed:', err);
    // Fall back to a static-only sitemap so search engines never get a
    // 5xx (which they treat as "site down" and back off crawling).
    const staticXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_ROUTES.map((r) =>
  urlEntry({ loc: `${SITE_URL}${r.path}`, changefreq: r.changefreq, priority: r.priority }),
).join('\n')}
</urlset>`;
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.status(200).send(staticXml);
  }
});

export default router;
