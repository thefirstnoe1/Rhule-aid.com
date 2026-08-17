import { describe, expect, it, vi, beforeEach } from 'vitest';
import { classifyRosterPosition, handleRosterRequest } from '../src/api/roster.ts';

const now = Date.now();
function cache(value?: string) { return { get: vi.fn(async () => value ?? null), put: vi.fn(async () => undefined) }; }
function request(sort?: string) { return new Request(`https://example.test/api/roster${sort ? `?sort=${sort}` : ''}`); }
const player = (number: number, position: string, category: string) => ({ number, name: position, position, class: '', height: '', weight: '', hometown: '', category });

describe('roster categories', () => {
  it('normalizes known aliases and puts unknown values in other', () => {
    expect(classifyRosterPosition(' QB ')).toBe('offense');
    expect(classifyRosterPosition('offensive-line')).toBe('offense');
    expect(classifyRosterPosition('DB')).toBe('defense');
    expect(classifyRosterPosition('Corner-back')).toBe('defense');
    expect(classifyRosterPosition('Safety')).toBe('defense');
    expect(classifyRosterPosition('Defensive Tackle')).toBe('defense');
    expect(classifyRosterPosition('EDGE rusher')).toBe('defense');
    expect(classifyRosterPosition('long-snapper')).toBe('special');
    expect(classifyRosterPosition('')).toBe('other');
    expect(classifyRosterPosition('mystery')).toBe('other');
  });

  it('rejects v4 and invalid category caches, accepts v5', async () => {
    const old = cache(JSON.stringify({ schema: 'v4', data: [player(1, 'QB', 'offense')], timestamp: now }));
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })));
    const oldResponse = await handleRosterRequest(request(), { ROSTER_CACHE: old });
    expect((await oldResponse.json()).cached).toBe(false);
    const valid = cache(JSON.stringify({ schema: 'v5', data: [player(1, 'QB', 'offense')], timestamp: now }));
    const validResponse = await handleRosterRequest(request(), { ROSTER_CACHE: valid });
    expect((await validResponse.json()).cached).toBe(true);
    const invalid = cache(JSON.stringify({ schema: 'v5', data: [player(1, 'QB', 'offense'), { ...player(2, '', 'offense'), category: 'bogus' }], timestamp: now }));
    const invalidResponse = await handleRosterRequest(request(), { ROSTER_CACHE: invalid });
    expect((await invalidResponse.json()).cached).toBe(false);
  });

  it('treats malformed JSON, invalid players, and invalid timestamps as cache misses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })));
    for (const value of [
      '{not-json',
      JSON.stringify({ schema: 'v5', data: [{ ...player(1, 'QB', 'offense'), name: 4 }], timestamp: now }),
      JSON.stringify({ schema: 'v5', data: [player(1, 'QB', 'offense')], timestamp: 'yesterday' }),
      JSON.stringify({ schema: 'v5', data: [player(1, 'QB', 'offense')], timestamp: now + 100000 }),
    ]) {
      const body = await (await handleRosterRequest(request(), { ROSTER_CACHE: cache(value) })).json();
      expect(body.cached).toBe(false);
    }
  });

  it('defaults to category order then jersey and preserves requested jersey sort', async () => {
    const data = [player(9, 'Unknown', 'other'), player(3, 'Punter', 'special'), player(7, 'DB', 'defense'), player(2, 'QB', 'offense')];
    const store = cache(JSON.stringify({ schema: 'v5', data, timestamp: now }));
    const defaultBody = await (await handleRosterRequest(request(), { ROSTER_CACHE: store })).json();
    expect(defaultBody.data.map((p: any) => p.category)).toEqual(['offense', 'defense', 'special', 'other']);
    const jerseyBody = await (await handleRosterRequest(request('jersey'), { ROSTER_CACHE: store })).json();
    expect(jerseyBody.data.map((p: any) => p.number)).toEqual([2, 3, 7, 9]);
  });
});
