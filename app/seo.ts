import type { Metadata } from 'next';

export const siteUrl = 'https://rhule-aid.com';

export function pageMetadata(title: string, description: string, pathname: string): Metadata {
  const url = `${siteUrl}${pathname}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: 'Rhule Aid',
      title,
      description,
      url
    },
    twitter: {
      card: 'summary',
      title,
      description
    }
  };
}
