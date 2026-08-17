import { beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequest } from '../src/api/cfb-schedule.ts';

function request(division?: 'all') {
  return new Request(`https://rhule-aid.com/api/cfb-schedule?season=2025&week=1${division ? `&division=${division}` : ''}`);
}

function context(division?: 'all'): Parameters<typeof onRequest>[0] {
  return { request: request(division), env: { CFBD_API_KEY: 'test-key' } } as Parameters<typeof onRequest>[0];
}

function cfbdGame(id: number, homeId = 1, awayId = 2) {
  return {
    id,
    week: 1,
    startDate: '2025-09-01T18:00:00.000Z',
    homeTeam: 'Nebraska',
    awayTeam: 'Iowa',
    homeId,
    awayId,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/teams/fbs')) return new Response(JSON.stringify([{ id: 1, conference: 'Big Ten' }, { id: 2, conference: 'Big Ten' }]), { status: 200 });
    if (url.includes('/games/media')) return new Response(JSON.stringify([{ id: 1, outlet: 'BTN' }]), { status: 200 });
    if (url.includes('collegefootballdata.com')) {
      const games = url.includes('classification=fbs')
        ? [cfbdGame(1), cfbdGame(3, 1, 9)]
        : [cfbdGame(1), cfbdGame(2, 3, 4)];
      return new Response(JSON.stringify(games), { status: 200 });
    }
    return new Response(JSON.stringify({ events: [] }), { status: 200 });
  }));
});

describe('CFBD division views', () => {
  it('requests authoritative FBS data by default', async () => {
    const response = await onRequest(context());
    const body = await response.json() as { games: unknown[] };

    expect(response.status).toBe(200);
    expect(body.games).toHaveLength(1);
    expect(String(vi.mocked(fetch).mock.calls.find(call => String(call[0]).includes('/games'))?.[0])).toContain('classification=fbs');
  });

  it('requests unfiltered data and includes FCS games for division=all', async () => {
    const response = await onRequest(context('all'));
    const body = await response.json() as { games: unknown[] };

    expect(response.status).toBe(200);
    expect(body.games).toHaveLength(2);
    expect((body.games[0] as { homeTeam: { conference: string } }).homeTeam.conference).toBe('Big Ten');
  });

  it('joins CFBD TV media to games by exact ID', async () => {
    const response = await onRequest(context());
    const body = await response.json() as { games: Array<{ id: string; tv: string }> };

    expect(body.games.find(game => game.id === '1')?.tv).toBe('BTN');
  });

  it('preserves TBD TV when CFBD media fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/teams/fbs')) return new Response(JSON.stringify([{ id: 1, conference: 'Big Ten' }, { id: 2, conference: 'Big Ten' }]), { status: 200 });
      if (url.includes('/games/media')) return new Response('unavailable', { status: 503 });
      if (url.includes('/games?')) return new Response(JSON.stringify([cfbdGame(1)]), { status: 200 });
      return new Response(JSON.stringify({ events: [] }), { status: 200 });
    }));

    const response = await onRequest(context());
    const body = await response.json() as { games: Array<{ tv: string }> };
    expect(response.status).toBe(200);
    expect(body.games[0].tv).toBe('TBD');
  });

  it('falls back permissively when the FBS team lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).includes('/teams/fbs')
      ? new Response('unavailable', { status: 503 })
      : String(input).includes('collegefootballdata.com')
        ? new Response(JSON.stringify([cfbdGame(1, 3, 4)]), { status: 200 })
        : new Response(JSON.stringify({ events: [] }), { status: 200 })));

    const response = await onRequest(context());
    const body = await response.json() as { games: unknown[] };
    expect(response.status).toBe(200);
    expect(body.games).toHaveLength(1);
  });
});
