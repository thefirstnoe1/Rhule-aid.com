import { describe, expect, it } from 'vitest';
import { handleGameCalendarRequest } from '../src/api/game-calendar.ts';
import { generateGameIcal } from '../src/lib/ical.ts';

const game = {
  season: 2025, gameKey: 'nebraska:2025:iowa', date: '2025-09-06', opponent: 'Iowa',
  homeTeam: 'Nebraska', awayTeam: 'Iowa', nebraskaLogo: '', opponentLogo: '', time: '7:00 PM',
  location: 'Memorial Stadium; Lincoln', network: 'NBC', tvNetwork: 'NBC', isHome: true,
  kickoffAt: '2025-09-07T00:00:00.000Z', kickoffStatus: 'confirmed' as const,
  venue: { name: 'Memorial Stadium; Lincoln', timezone: 'America/Chicago' as const },
};

function cache(payload = [game], season = 2025) {
  const values = new Map([[`nebraska_schedule_${season}_cfbd_huskers_v7`, JSON.stringify({
    schema: 'v7', payload, season, source: 'test', dataUpdatedAt: Date.now(),
    freshUntil: Date.now() + 1000, retainUntil: Date.now() + 10000,
  })]]);
  return { get: async (key: string) => values.get(key) || null };
}

function request(query: string) { return new Request(`https://rhule-aid.com/api/games/calendar?${query}`); }

describe('game calendar', () => {
  it('generates folded, escaped RFC5545 output from retained canonical data', async () => {
    const response = await handleGameCalendarRequest(request('season=2025&gameKey=nebraska%3A2025%3Aiowa&opponent=attacker'), { SCHEDULE_CACHE: cache() });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/calendar; charset=utf-8');
    expect(text).toContain('SUMMARY:Iowa at Nebraska');
    expect(text).toContain('LOCATION:Memorial Stadium\\; Lincoln');
    expect(text).not.toContain('attacker');
    expect(text).toContain('TRIGGER:-PT1H');
    expect(text).toMatch(/\r\n/);
    for (const line of text.split('\r\n').filter(Boolean)) expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
  });

  it('rejects invalid keys and does not use query event content', async () => {
    expect((await handleGameCalendarRequest(request('season=2025&gameKey=bad%2Fkey'), { SCHEDULE_CACHE: cache() })).status).toBe(400);
    expect((await handleGameCalendarRequest(request('season=2025&gameKey=nebraska%3A2025%3Aunknown'), { SCHEDULE_CACHE: cache() })).status).toBe(404);
  });

  it('rejects TBA games', async () => {
    expect((await handleGameCalendarRequest(request('season=2025&gameKey=nebraska%3A2025%3Aiowa'), { SCHEDULE_CACHE: cache([{ ...game, kickoffStatus: 'tba', kickoffAt: undefined } as any]) })).status).toBe(409);
  });

  it('uses stable game UID hash', () => {
    const one = generateGameIcal(game, new Date('2026-01-01T00:00:00Z'));
    const two = generateGameIcal(game, new Date('2026-01-01T00:00:00Z'));
    expect(one).toBe(two);
    expect(one).toContain('@rhule-aid.com');
  });

  it('accepts safe fallback keys containing spaces', async () => {
    const fallback = { ...game, gameKey: 'nebraska:2026:michigan state', season: 2026 };
    const response = await handleGameCalendarRequest(
      request('season=2026&gameKey=nebraska%3A2026%3Amichigan%20state'),
      { SCHEDULE_CACHE: cache([fallback], 2026) },
    );
    expect(response.status).toBe(200);
  });

  it('always emits basic UTC date-times without fractional seconds', () => {
    const output = generateGameIcal({ ...game, kickoffAt: '2025-09-07T00:00:01.987Z' }, new Date('2026-01-01T00:00:02.345Z'));
    expect(output).toContain('DTSTART:20250907T000001Z');
    expect(output).toContain('DTSTAMP:20260101T000002Z');
    expect(output).not.toMatch(/DT(?:START|STAMP):[^\r\n]*\./);
  });
});
