import { Helmet } from 'react-helmet-async';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { buildOrganizationSchema, buildWebSiteSchema } from './schemas';

/**
 * Emits the two schemas that should appear on every public page:
 * `EducationalOrganization` (the canonical RDSWA entity) and `WebSite`
 * (with the SearchAction so branded SERPs render the sitelinks search box).
 *
 * Mounted once at the PublicLayout root rather than per-page so the schemas
 * stay coherent across navigation — react-helmet-async deduplicates by
 * content, so per-page <SEO> blocks adding their own JSON-LD will stack
 * cleanly without colliding with these base schemas.
 *
 * The Organization schema is dynamically populated from SiteSettings when
 * the admin has configured contact info / social links — we read settings
 * at render time so a future admin edit appears in the schema without any
 * code change. Settings may be undefined on first paint (cold cache), in
 * which case the helper still emits the static portion of the schema.
 */
export default function BaseJsonLd() {
  const { settings } = useSiteSettings();

  const socialLinks = [
    settings?.socialLinks?.facebook,
    settings?.socialLinks?.twitter,
    settings?.socialLinks?.youtube,
    settings?.socialLinks?.linkedin,
  ].filter((u): u is string => typeof u === 'string' && u.length > 0);

  const orgSchema = buildOrganizationSchema({
    email: settings?.contactEmail,
    phone: settings?.contactPhone,
    address: settings?.address,
    socialLinks: socialLinks.length ? socialLinks : undefined,
  });

  const webSiteSchema = buildWebSiteSchema();

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(orgSchema)}</script>
      <script type="application/ld+json">{JSON.stringify(webSiteSchema)}</script>
    </Helmet>
  );
}
