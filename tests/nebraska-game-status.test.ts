import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleNebraskaGameStatusRequest } from '../src/api/nebraska-game-status.ts';

const now = new Date('2026-07-14T12:00:00.000Z').getTime();
const game = { season: 2025, gameKey: 'nebraska:2025:iowa', opponent: 'Iowa', homeTeam: 'Nebraska', awayTeam: 'Iowa', providerIds: { espn: 'opaque-event-1' } };
const scheduleKey = 'nebraska_schedule_2025_cfbd_huskers_v7';

function cache(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return { get: vi.fn(async (key: string) => map.get(key) ?? null), put: vi.fn(async (key: string, value: string) => map.set(key, value)) };
}

function schedule() { return JSON.stringify({ schema: 'v7', payload: [game], dataUpdatedAt: now - 1000, freshUntil: now + 60000, retainUntil: now + 600000, source: 'test', season: 2025 }); }
function request(query = '?season=2025&gameKey=nebraska%3A2025%3Aiowa') { return new Request(`https://example.test/api/games/status${query}`); }
function event(status = 'STATUS_IN_PROGRESS', id = 'opaque-event-1', opponent = 'Iowa') { return { events: [{ id, competitions: [{ status: { type: { name: status, state: status === 'STATUS_IN_PROGRESS' ? 'in' : 'post', shortDetail: status === 'STATUS_FINAL' ? 'Final' : '2nd 05:10' } }, situation: { period: 2, displayClock: '05:10' }, competitors: [{ homeAway: 'home', team: { id: '158', location: 'Nebraska' }, score: '14' }, { homeAway: 'away', team: { id: '2294', location: opponent }, score: '7' }] }] }] }; }

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubGlobal('fetch', vi.fn()); });

describe('Nebraska game status', () => {
  it('validates season and game key', async () => {
    const response = await handleNebraskaGameStatusRequest(request('?season=nope'), {});
    expect(response.status).toBe(400);
  });

  it('requires canonical retained ESPN ID', async () => {
    const scheduleCache = cache();
    const response = await handleNebraskaGameStatusRequest(request(), { SCHEDULE_CACHE: scheduleCache, CFB_SCHEDULE_CACHE: cache() });
    expect(response.status).toBe(502);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects an event with wrong ID or competitor', async () => {
    const scheduleCache = cache({ [scheduleKey]: schedule() });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(event('STATUS_FINAL', 'other-id', 'Ohio State')), { status: 200 }));
    const response = await handleNebraskaGameStatusRequest(request(), { SCHEDULE_CACHE: scheduleCache, CFB_SCHEDULE_CACHE: cache() });
    expect(response.status).toBe(502);
  });

  it('returns live and final safe fields and caches validated payload', async () => {
    const scheduleCache = cache({ [scheduleKey]: schedule() });
    const statusCache = cache();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(event()), { status: 200 }));
    const live = await (await handleNebraskaGameStatusRequest(request(), { SCHEDULE_CACHE: scheduleCache, CFB_SCHEDULE_CACHE: statusCache })).json();
    expect(live.data.status).toBe('live');
    expect(live.data.score).toEqual({ nebraska: 14, opponent: 7 });
    expect(live.data.nextPollSeconds).toBe(30);
    expect(statusCache.put).toHaveBeenCalledWith('nebraska-status:v1:2025:nebraska:2025:iowa', expect.any(String), expect.objectContaining({ expirationTtl: 300 }));
  });

  it('serves retained stale status on timeout', async () => {
    const scheduleCache = cache({ [scheduleKey]: schedule() });
    const statusCache = cache({
      'nebraska-status:v1:2025:nebraska:2025:iowa': JSON.stringify({ schema: 'nebraska-status:v1', season: 2025, gameKey: game.gameKey, payload: { season: 2025, gameKey: game.gameKey, status: 'final', homeTeam: 'Nebraska', awayTeam: 'Iowa', nextPollSeconds: 60 }, dataUpdatedAt: now - 60000, freshUntil: now - 1, retainUntil: now + 240000 }),
    });
    vi.mocked(fetch).mockRejectedValue(new Error('timeout'));
    const response = await handleNebraskaGameStatusRequest(request(), { SCHEDULE_CACHE: scheduleCache, CFB_SCHEDULE_CACHE: statusCache });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.freshness.stale).toBe(true);
  });
});
