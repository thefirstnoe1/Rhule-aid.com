import type { AlertFreshness, SourceHealth } from '../contracts/gameday';

const ALERTS_URL = 'https://api.weather.gov/alerts/active?point=40.8136,-96.7026';
const CACHE_KEY = 'weather-alerts:v1:lincoln';
const SCHEMA = 'weather-alerts:v1';
const DEADLINE_MS = 5_000;
const FRESH_SECONDS = 30;
const RETAIN_SECONDS = 10 * 60;

interface SafeAlert {
  id: string;
  event: string;
  headline?: string;
  description?: string;
  instruction?: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  effective?: string;
  onset?: string;
  expires: string;
  areaDesc?: string;
  web?: string;
}

interface AlertEnvelope {
  schema: string;
  payload: SafeAlert[];
  dataUpdatedAt: number;
  freshUntil: number;
  retainUntil: number;
}

export async function handleWeatherAlertsRequest(request: Request, env: any): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'GET') return response({ success: false, data: [], error: 'method_not_allowed' }, 405, headers);

  const now = Date.now();
  const cached = await readCache(env.WEATHER_CACHE, now);
  const cachedPayload = cached ? filterValidAlerts(cached.payload, now) : null;
  if (cached && cached.freshUntil > now && cachedPayload) return success(cachedPayload, true, false, cached.dataUpdatedAt, headers);

  try {
    const payload = await fetchAlerts();
    const dataUpdatedAt = Date.now();
    try { await writeCache(env.WEATHER_CACHE, payload, dataUpdatedAt); } catch { /* cache is advisory */ }
    return success(payload, false, false, dataUpdatedAt, headers);
  } catch {
    if (cached && cached.retainUntil > now && cachedPayload) return success(cachedPayload, true, true, cached.dataUpdatedAt, headers);
    return response({ success: false, data: [], error: 'upstream_unavailable', meta: meta(false, true, now) }, 502, headers);
  }
}

async function fetchAlerts(): Promise<SafeAlert[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const upstream = await fetch(ALERTS_URL, { headers: { Accept: 'application/geo+json', 'User-Agent': 'Rhule-Aid/1.0 (https://rhule-aid.com)' }, signal: controller.signal });
    if (!upstream.ok) throw new Error('upstream');
    const body = await upstream.json() as any;
    if (!body || body.type !== 'FeatureCollection' || !Array.isArray(body.features)) throw new Error('invalid');
    const now = Date.now();
    return body.features.map((feature: any) => parseAlert(feature, now)).filter((alert: SafeAlert | null): alert is SafeAlert => alert !== null);
  } finally { clearTimeout(timer); }
}

function parseAlert(feature: any, now: number): SafeAlert | null {
  const p = feature?.properties;
  if (!p || typeof feature.id !== 'string' || typeof p.event !== 'string' || typeof p.expires !== 'string') return null;
  const expires = Date.parse(p.expires);
  const effective = p.effective ? Date.parse(p.effective) : NaN;
  if (!Number.isFinite(expires) || expires <= now || (Number.isFinite(effective) && effective > now)) return null;
  if (p.status !== 'Actual' || p.messageType === 'Cancel' || p.cancelled === true) return null;
  return {
    id: feature.id, event: p.event, ...(typeof p.headline === 'string' ? { headline: p.headline } : {}),
    ...(typeof p.description === 'string' ? { description: p.description } : {}), ...(typeof p.instruction === 'string' ? { instruction: p.instruction } : {}),
    ...(typeof p.severity === 'string' ? { severity: p.severity } : {}), ...(typeof p.urgency === 'string' ? { urgency: p.urgency } : {}), ...(typeof p.certainty === 'string' ? { certainty: p.certainty } : {}),
    ...(typeof p.effective === 'string' ? { effective: p.effective } : {}), ...(typeof p.onset === 'string' ? { onset: p.onset } : {}), expires: p.expires,
    ...(typeof p.areaDesc === 'string' ? { areaDesc: p.areaDesc } : {}), ...(typeof p.web === 'string' ? { web: p.web } : {}),
  };
}

async function readCache(cache: any, now: number): Promise<AlertEnvelope | null> {
  if (!cache) return null;
  try {
    const parsed = JSON.parse(await cache.get(CACHE_KEY));
    const validPayload = Array.isArray(parsed?.payload) && parsed.payload.every((alert: any) => typeof alert?.id === 'string' && typeof alert?.event === 'string' && typeof alert?.expires === 'string' && Number.isFinite(Date.parse(alert.expires)));
    return parsed?.schema === SCHEMA && validPayload && Number.isFinite(parsed.dataUpdatedAt) && Number.isFinite(parsed.freshUntil) && Number.isFinite(parsed.retainUntil) && parsed.retainUntil > now ? parsed : null;
  } catch { return null; }
}

async function writeCache(cache: any, payload: SafeAlert[], dataUpdatedAt: number) {
  if (!cache) return;
  const earliestExpiry = payload.reduce((earliest, alert) => Math.min(earliest, Date.parse(alert.expires)), Infinity);
  const freshnessSeconds = Number.isFinite(earliestExpiry) ? Math.max(1, Math.min(FRESH_SECONDS, Math.ceil((earliestExpiry - dataUpdatedAt) / 1000))) : FRESH_SECONDS;
  const envelope: AlertEnvelope = { schema: SCHEMA, payload, dataUpdatedAt, freshUntil: dataUpdatedAt + freshnessSeconds * 1000, retainUntil: dataUpdatedAt + RETAIN_SECONDS * 1000 };
  await cache.put(CACHE_KEY, JSON.stringify(envelope), { expirationTtl: Math.max(60, RETAIN_SECONDS) });
}

function filterValidAlerts(payload: SafeAlert[], now: number): SafeAlert[] {
  return payload.filter((alert) => typeof alert?.id === 'string' && typeof alert.event === 'string' && typeof alert.expires === 'string' && Number.isFinite(Date.parse(alert.expires)) && Date.parse(alert.expires) > now && (!alert.effective || !Number.isFinite(Date.parse(alert.effective)) || Date.parse(alert.effective) <= now));
}

function meta(cached: boolean, stale: boolean, updated: number): { freshness: AlertFreshness; sourceHealth: Record<string, SourceHealth> } {
  return { freshness: { cached, stale, source: 'nws', dataUpdatedAt: new Date(updated).toISOString(), servedAt: new Date().toISOString(), sourceState: stale ? 'unavailable' : 'live' }, sourceHealth: { nws: { state: stale ? 'unavailable' : 'live', stale } } };
}
function success(data: SafeAlert[], cached: boolean, stale: boolean, updated: number, headers: Record<string, string>) {
  const maxAge = Math.min(30, ...data.map((alert) => Math.max(0, Math.floor((Date.parse(alert.expires) - Date.now()) / 1000))));
  return response({ success: true, data, cached, meta: meta(cached, stale, updated) }, 200, headers, stale ? 'no-store' : `public, max-age=${maxAge}`);
}
function response(body: unknown, status: number, headers: Record<string, string>, cacheControl = 'no-store') { return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Cache-Control': cacheControl } }); }
