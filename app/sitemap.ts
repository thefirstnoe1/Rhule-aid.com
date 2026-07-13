import type { MetadataRoute } from 'next';
import { siteUrl } from './seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/news', '/schedule', '/gameday', '/roster', '/cfb-schedule', '/brett', '/soccer', '/rhule-aid'];

  return routes.map((route): MetadataRoute.Sitemap[number] => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === '/news' || route === '/schedule' || route === '/gameday' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : 0.7
  }));
}
