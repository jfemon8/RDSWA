import { Helmet } from 'react-helmet-async';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { buildOrganizationSchema, buildWebSiteSchema } from './schemas';

/** Emits the base `EducationalOrganization` and `WebSite` schemas once at the layout root, filling them from SiteSettings when available. */
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
