import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleWeatherAlertsRequest } from '../src/api/weather-alerts.ts';

const now = new Date('2026-07-14T12:00:00.000Z').getTime();
const key = 'weather-alerts:v1:lincoln';
function cache(values: Record<string, string> = {}) { const map = new Map(Object.entries(values)); return { get: vi.fn(async (k: string) => map.get(k) ?? null), put: vi.fn(async (k: string, v: string) => map.set(k, v)) }; }
function feature(overrides: Record<string, unknown> = {}) { return { type: 'Feature', id: 'https://api.weather.gov/alerts/1', geometry: null, properties: { status: 'Actual', messageType: 'Alert', event: 'Test Alert', headline: 'Stay safe', expires: '2026-07-14T13:00:00Z', effective: '2026-07-14T11:00:00Z', ...overrides } }; }
function request(method = 'GET') { return new Request('https://example.test/api/weather/alerts', { method }); }

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubGlobal('fetch', vi.fn()); });

describe('weather alerts', () => {
  it('filters expired, cancelled, and future alerts while accepting null geometry', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ type: 'FeatureCollection', features: [feature({ onset: '2026-07-14T13:00:00Z' }), feature({ messageType: 'Cancel', id: 'cancel' }), feature({ expires: '2026-07-14T11:00:00Z', id: 'expired' }), feature({ effective: '2026-07-14T13:00:00Z', id: 'future' })] }), { status: 200 }));
    const body = await (await handleWeatherAlertsRequest(request(), { WEATHER_CACHE: cache() })).json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toContain('/1');
    expect(body.data[0].geometry).toBeUndefined();
  });

  it('caches valid empty GeoJSON responses with physical TTL', async () => {
    const store = cache();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 }));
    const response = await handleWeatherAlertsRequest(request(), { WEATHER_CACHE: store });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
    expect(store.put).toHaveBeenCalledWith(key, expect.any(String), expect.objectContaining({ expirationTtl: 600 }));
  });

  it('bounds response max-age by earliest current alert expiration', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ type: 'FeatureCollection', features: [feature({ expires: '2026-07-14T12:00:10.900Z' })] }), { status: 200 }));
    const response = await handleWeatherAlertsRequest(request(), { WEATHER_CACHE: cache() });
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=10');
  });

  it('re-filters expired cached alerts before serving', async () => {
    const store = cache({ [key]: JSON.stringify({ schema: 'weather-alerts:v1', payload: [{ id: 'expired', event: 'Old', expires: '2026-07-14T11:00:00Z' }], dataUpdatedAt: now - 1000, freshUntil: now + 20000, retainUntil: now + 600000 }) });
    const response = await handleWeatherAlertsRequest(request(), { WEATHER_CACHE: store });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns validated data when advisory cache write fails', async () => {
    const store = cache();
    store.put.mockRejectedValue(new Error('KV unavailable'));
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ type: 'FeatureCollection', features: [feature()] }), { status: 200 }));
    const response = await handleWeatherAlertsRequest(request(), { WEATHER_CACHE: store });
    expect(response.status).toBe(200);
    expect((await response.json()).data).toHaveLength(1);
  });

  it('rejects malformed upstream payloads without caching', async () => {
    const store = cache();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ nope: true }), { status: 200 }));
    const response = await handleWeatherAlertsRequest(request(), { WEATHER_CACHE: store });
    expect(response.status).toBe(502);
    expect(store.put).not.toHaveBeenCalled();
  });

  it.each([429, 500, 503])('serves stale cache on upstream %s', async (status) => {
    const staleAlert = { ...feature().properties, id: 'https://api.weather.gov/alerts/stale' };
    const store = cache({ [key]: JSON.stringify({ schema: 'weather-alerts:v1', payload: [staleAlert], dataUpdatedAt: now - 60000, freshUntil: now - 1, retainUntil: now + 600000 }) });
    vi.mocked(fetch).mockResolvedValue(new Response('unavailable', { status }));
    const response = await handleWeatherAlertsRequest(request(), { WEATHER_CACHE: store });
    expect(response.status).toBe(200);
    expect((await response.json()).meta.freshness.stale).toBe(true);
    expect(store.put).not.toHaveBeenCalled();
  });

  it('returns failure on timeout without retained data and sends NWS headers', async () => {
    vi.mocked(fetch).mockImplementation(async (_input, init) => new Promise((_resolve, reject) => (init as RequestInit).signal?.addEventListener('abort', () => reject(new Error('timeout')))));
    const promise = handleWeatherAlertsRequest(request(), { WEATHER_CACHE: cache() });
    await vi.advanceTimersByTimeAsync(5001);
    expect((await promise).status).toBe(502);
    expect(vi.mocked(fetch).mock.calls[0][1]).toEqual(expect.objectContaining({ headers: expect.objectContaining({ Accept: 'application/geo+json', 'User-Agent': expect.stringContaining('Rhule-Aid') }) }));
  });
});
