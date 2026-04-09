import { Helmet } from 'react-helmet-async';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export default function SEO({
  title,
  description,
  image = '/og-image.png',
  url,
  type = 'website',
}: SEOProps) {
  const { settings } = useSiteSettings();
  const siteName = settings?.siteName || 'RDSWA';
  const fullSiteName = settings?.siteNameFull ? `${siteName} - ${settings.siteNameFull}` : siteName;
  const pageTitle = title ? `${title} | ${siteName}` : fullSiteName;
  const desc = description || `Official platform of ${settings?.siteNameFull || siteName}. Member directory, events, notices, committees, and more.`;
  const favicon = settings?.favicon;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={desc} />
      {favicon && <link rel="icon" href={favicon} />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={image} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
