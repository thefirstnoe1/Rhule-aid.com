export interface SportsTeamStructuredData {
  '@context': 'https://schema.org';
  '@type': 'SportsTeam';
  '@id': string;
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[];
}

export interface WebSiteStructuredData {
  '@context': 'https://schema.org';
  '@type': 'WebSite';
  '@id': string;
  name: string;
  url: string;
}

export interface SportsEventStructuredData {
  '@context': 'https://schema.org';
  '@type': 'SportsEvent';
  '@id': string;
  name: string;
  homeTeam: { '@type': 'SportsTeam'; '@id'?: string; name: string };
  awayTeam: { '@type': 'SportsTeam'; '@id'?: string; name: string };
  startDate: string;
  location: { '@type': 'Place'; name: string; address: { '@type': 'PostalAddress'; streetAddress: string; addressLocality: string; addressRegion: string; postalCode: string } };
  url: string;
}

export interface NewsItemListStructuredData {
  '@context': 'https://schema.org';
  '@type': 'ItemList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    item: { '@type': 'NewsArticle'; headline: string; url: string; datePublished?: string };
  }>;
}

export interface SportsTeamInput { name: string; url: string; id?: string; logo?: string; sameAs?: string[]; }
export interface SportsEventInput {
  gameKey: string;
  name: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt?: string;
  kickoffStatus?: 'confirmed' | 'tba';
  venue?: { name: string; verified?: boolean; address?: { street: string; city: string; region: string; postalCode: string } };
  url?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  season?: number;
}
export interface ExternalNewsItem { headline: string; url: string; datePublished?: string; }

export function stableSportsTeamId(teamKey: string, siteUrl = 'https://rhule-aid.com'): string {
  const base = new URL(siteUrl);
  return `${base.origin}/#${encodeURIComponent(teamKey.trim())}`;
}

export function createWebSiteStructuredData(siteUrl: string, name: string): WebSiteStructuredData | null {
  if (!name?.trim() || !isAbsoluteHttpUrl(siteUrl)) return null;
  return { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${new URL(siteUrl).origin}/#website`, name: name.trim(), url: siteUrl };
}

export function createSportsTeamStructuredData(input: SportsTeamInput): SportsTeamStructuredData | null {
  if (!input?.name?.trim() || !isAbsoluteHttpUrl(input.url)) return null;
  const logo = input.logo && isAbsoluteHttpUrl(input.logo) ? input.logo : undefined;
  const sameAs = input.sameAs?.filter(isAbsoluteHttpUrl);
  return { '@context': 'https://schema.org', '@type': 'SportsTeam', '@id': input.id && isAbsoluteHttpUrl(input.id) ? input.id : input.url, name: input.name.trim(), url: input.url, ...(logo ? { logo } : {}), ...(sameAs?.length ? { sameAs } : {}) };
}

export function stableGameId(gameKey: string, siteUrl = 'https://rhule-aid.com'): string {
  const base = new URL(siteUrl);
  return `${base.origin}/#game-${encodeURIComponent(gameKey.trim())}`;
}

export function stableGameUrl(gameKey: string, season?: number, siteUrl = 'https://rhule-aid.com'): string {
  const base = new URL(siteUrl);
  const resolvedSeason = season || deriveGameSeason(gameKey);
  const params = new URLSearchParams({ game: gameKey.trim(), ...(resolvedSeason ? { season: String(resolvedSeason) } : {}) });
  return `${base.origin}/gameday?${params.toString()}`;
}

export function createVerifiedSportsEventStructuredData(input: SportsEventInput): SportsEventStructuredData | null {
  if (!input?.gameKey?.trim() || !input.name?.trim() || !input.homeTeam?.trim() || !input.awayTeam?.trim()) return null;
  if (input.kickoffStatus !== 'confirmed' || !isConfirmedIsoDate(input.kickoffAt)) return null;
  if (!input.venue?.verified || !input.venue.name.trim() || !input.venue.address || !Object.values(input.venue.address).every((value) => value.trim())) return null;
  if (!input.url || !isAbsoluteHttpUrl(input.url) || !isGameDayUrlForKey(input.url, input.gameKey, input.season)) return null;

  return {
    '@context': 'https://schema.org', '@type': 'SportsEvent', '@id': stableGameId(input.gameKey), name: input.name.trim(),
    homeTeam: { '@type': 'SportsTeam', name: input.homeTeam.trim(), ...(input.homeTeamId && isAbsoluteHttpUrl(input.homeTeamId) ? { '@id': input.homeTeamId } : {}) },
    awayTeam: { '@type': 'SportsTeam', name: input.awayTeam.trim(), ...(input.awayTeamId && isAbsoluteHttpUrl(input.awayTeamId) ? { '@id': input.awayTeamId } : {}) },
    startDate: input.kickoffAt,
    location: { '@type': 'Place', name: input.venue.name.trim(), address: { '@type': 'PostalAddress', streetAddress: input.venue.address.street.trim(), addressLocality: input.venue.address.city.trim(), addressRegion: input.venue.address.region.trim(), postalCode: input.venue.address.postalCode.trim() } },
    url: input.url,
  };
}

export function createExternalNewsItemListStructuredData(items: ExternalNewsItem[], allowedHosts: readonly string[]): NewsItemListStructuredData {
  const safeItems = (items || []).filter((item) => item?.headline?.trim() && isAllowedNewsUrl(item.url, allowedHosts));
  return { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: safeItems.map((item, index) => ({ '@type': 'ListItem', position: index + 1, item: { '@type': 'NewsArticle', headline: item.headline.trim(), url: item.url, ...(isConfirmedIsoDate(item.datePublished) ? { datePublished: item.datePublished } : {}) } })) };
}

export function serializeStructuredData(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function isAbsoluteHttpUrl(value: unknown): value is string {
  try { const url = new URL(String(value)); return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password; } catch { return false; }
}

function isAllowedNewsUrl(value: unknown, allowedHosts: readonly string[]): value is string {
  if (!isAbsoluteHttpUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase();
  return allowedHosts.some((allowed) => { const normalized = allowed.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''); return host === normalized; });
}

function isGameDayUrlForKey(value: string, gameKey: string, season?: number): boolean {
  try {
    const url = new URL(value);
    const urlSeason = Number(url.searchParams.get('season'));
    return url.pathname === '/gameday' && url.searchParams.get('game') === gameKey.trim() && Number.isInteger(urlSeason) && urlSeason === (season || deriveGameSeason(gameKey)) && !url.hash;
  } catch {
    return false;
  }
}

export function deriveGameSeason(gameKey: string): number | undefined {
  const match = /^nebraska:(\d{4}):/.exec(gameKey.trim());
  const season = match ? Number(match[1]) : undefined;
  return season && season >= 1900 && season <= 2100 ? season : undefined;
}

function isConfirmedIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  const seconds = Number(match[6]);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || hours > 23 || minutes > 59 || seconds > 59) return false;
  const zone = match[7] || '';
  if (zone !== 'Z') {
    const offset = zone.replace(':', '');
    if (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(3, 5)) > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}
