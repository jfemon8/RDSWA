import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

const SITE_NAME = 'RDSWA - Rangpur Divisional Student Welfare Association';
const DEFAULT_DESC = 'Official platform of Rangpur Divisional Student Welfare Association, University of Barishal. Member directory, events, notices, committees, and more.';

export default function SEO({
  title,
  description = DEFAULT_DESC,
  image = '/og-image.png',
  url,
  type = 'website',
}: SEOProps) {
  const pageTitle = title ? `${title} | RDSWA` : SITE_NAME;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={description} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      {url && <meta property="og:url" content={url} />}
      <meta property="og:site_name" content="RDSWA" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
