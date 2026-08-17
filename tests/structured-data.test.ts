import { describe, expect, it } from 'vitest';
import { createExternalNewsItemListStructuredData, createSportsTeamStructuredData, createVerifiedSportsEventStructuredData, createWebSiteStructuredData, serializeStructuredData, stableGameId, stableSportsTeamId } from '../src/lib/structured-data.ts';

describe('structured data', () => {
  it('escapes embedding-sensitive characters while remaining parseable', () => {
    const value = { text: '<script>&\u2028\u2029' };
    const serialized = serializeStructuredData(value);
    expect(serialized).not.toContain('<script>');
    expect(JSON.parse(serialized).text).toBe(value.text);
  });

  it('validates absolute URLs and news host allowlists', () => {
    expect(createSportsTeamStructuredData({ name: 'Nebraska', url: 'javascript:alert(1)' })).toBeNull();
    const list = createExternalNewsItemListStructuredData([{ headline: 'Safe', url: 'https://news.example.test/story' }, { headline: 'Unsafe', url: 'https://evil.test/story' }], ['news.example.test']);
    expect(list.itemListElement).toHaveLength(1);
  });

  it('omits datePublished when external news has no source date', () => {
    const list = createExternalNewsItemListStructuredData([{ headline: 'Undated', url: 'https://news.example.test/story' }], ['news.example.test']);
    expect(list.itemListElement[0]?.item).not.toHaveProperty('datePublished');
  });

  it('omits unverified TBA dates and locations', () => {
    const event = createVerifiedSportsEventStructuredData({ gameKey: 'nebraska:2026:iowa', name: 'Iowa at Nebraska', homeTeam: 'Nebraska', awayTeam: 'Iowa', kickoffStatus: 'tba', kickoffAt: 'not-a-date', venue: { name: 'Memorial Stadium', verified: false } });
    expect(event).toBeNull();
  });

  it('accepts confirmed ISO dates and creates stable game IDs', () => {
    const input = { gameKey: 'nebraska:2026:iowa', season: 2026, name: 'Iowa at Nebraska', homeTeam: 'Nebraska', awayTeam: 'Iowa', kickoffStatus: 'confirmed' as const, kickoffAt: '2026-09-05T19:00:00-05:00', venue: { name: 'Memorial Stadium', verified: true, address: { street: '1 Stadium Drive', city: 'Lincoln', region: 'NE', postalCode: '68588' } }, url: 'https://rhule-aid.com/gameday?game=nebraska%3A2026%3Aiowa&season=2026' };
    const first = createVerifiedSportsEventStructuredData(input);
    const second = createVerifiedSportsEventStructuredData(input);
    expect(first?.startDate).toBe('2026-09-05T19:00:00-05:00');
    expect(first?.['@id']).toBe(second?.['@id']);
    expect(first?.['@id']).toBe(stableGameId('nebraska:2026:iowa'));
  });

  it('rejects impossible calendar dates and accepts valid ISO instants', () => {
    const base = { gameKey: 'nebraska:2026:iowa', name: 'Iowa at Nebraska', homeTeam: 'Nebraska', awayTeam: 'Iowa', kickoffStatus: 'confirmed' as const, venue: { name: 'Memorial Stadium', verified: true, address: { street: '1 Stadium Drive', city: 'Lincoln', region: 'NE', postalCode: '68588' } }, url: 'https://rhule-aid.com/gameday?game=nebraska%3A2026%3Aiowa&season=2026' };
    const invalid = createVerifiedSportsEventStructuredData({ ...base, kickoffAt: '2026-02-30T19:00:00Z' });
    const valid = createVerifiedSportsEventStructuredData({ ...base, kickoffAt: '2026-02-28T19:00:00Z' });
    expect(invalid).toBeNull();
    expect(valid?.startDate).toBe('2026-02-28T19:00:00Z');
  });

  it('keeps website and team identities separate and references Nebraska from events', () => {
    const website = createWebSiteStructuredData('https://rhule-aid.com', 'Rhule Aid');
    const team = createSportsTeamStructuredData({ name: 'Nebraska Cornhuskers', url: 'https://rhule-aid.com', id: stableSportsTeamId('nebraska-cornhuskers') });
    const event = createVerifiedSportsEventStructuredData({
      gameKey: 'nebraska:2026:iowa', season: 2026, name: 'Nebraska vs. Iowa', homeTeam: 'Nebraska', awayTeam: 'Iowa',
      homeTeamId: stableSportsTeamId('nebraska-cornhuskers'), kickoffStatus: 'confirmed', kickoffAt: '2026-09-05T19:00:00-05:00',
      venue: { name: 'Memorial Stadium', verified: true, address: { street: '1 Stadium Drive', city: 'Lincoln', region: 'NE', postalCode: '68588' } }, url: 'https://rhule-aid.com/gameday?game=nebraska%3A2026%3Aiowa&season=2026',
    });
    expect(website?.['@id']).not.toBe(team?.['@id']);
    expect(event?.homeTeam['@id']).toBe(team?.['@id']);
    expect(event?.location?.address).toMatchObject({ streetAddress: '1 Stadium Drive', addressLocality: 'Lincoln', addressRegion: 'NE', postalCode: '68588' });
    expect(event?.url).toContain('/gameday?game=');
  });

  it('suppresses events without an authoritative verified address or exact game URL', () => {
    const base = { gameKey: 'nebraska:2026:iowa', name: 'Nebraska vs. Iowa', homeTeam: 'Nebraska', awayTeam: 'Iowa', kickoffStatus: 'confirmed' as const, kickoffAt: '2026-09-05T19:00:00-05:00' };
    expect(createVerifiedSportsEventStructuredData({ ...base, venue: { name: 'Memorial Stadium', verified: true }, url: 'https://rhule-aid.com/gameday?game=other&season=2026' })).toBeNull();
    expect(createVerifiedSportsEventStructuredData({ ...base, venue: { name: 'Memorial Stadium', verified: false, address: { street: '1 Stadium Drive', city: 'Lincoln', region: 'NE', postalCode: '68588' } }, url: 'https://rhule-aid.com/gameday?game=nebraska%3A2026%3Aiowa&season=2026' })).toBeNull();
  });
});
