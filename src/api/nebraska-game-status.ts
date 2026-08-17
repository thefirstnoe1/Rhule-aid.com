import { selectPayload, type CacheEnvelope } from '../lib/cache-envelope';
import { readRetainedScheduleCache } from '../lib/schedule-cache';
import type { CanonicalScheduleGame, LiveGameState, LiveGameStatus, LiveGameStatusResponse } from '../contracts/gameday';

const SCHEDULE_SCHEMA = 'v7';
const STATUS_SCHEMA = 'nebraska-status:v1';
const ESPN_DEADLINE_MS = 5_000;
const LIVE_TTL_SECONDS = 30;
const OTHER_TTL_SECONDS = 60;
const RETAIN_SECONDS = 5 * 60;

type StatusPayload = LiveGameStatus;

interface CachedStatus extends CacheEnvelope<StatusPayload> {
  schema: string;
  source: string;
  season: number;
  gameKey: string;
}

export async function handleNebraskaGameStatusRequest(request: Request, env: any): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'GET') return json({ success: false, error: 'method_not_allowed' }, 405, headers);

  const url = new URL(request.url);
  const season = Number(url.searchParams.get('season'));
  const gameKey = url.searchParams.get('gameKey')?.trim();
  if (!Number.isInteger(season) || season < 1869 || season > 2200 || !gameKey || gameKey.length > 200) {
    return json({ success: false, error: 'invalid_request' }, 400, headers);
  }

  const statusKey = `nebraska-status:v1:${season}:${gameKey}`;
  let cached = await readStatusCache(env.CFB_SCHEDULE_CACHE, statusKey, season, gameKey);
  const cachedSelection = selectPayload(cached);
  if (cachedSelection.state === 'fresh') {
    return json(statusResponse(withFreshness(cachedSelection.payload, true, false, cachedSelection.envelope.dataUpdatedAt), true), 200, headers, 'public, max-age=30');
  }

  try {
    const schedule = await readRetainedScheduleCache(env.SCHEDULE_CACHE, scheduleKey(season), SCHEDULE_SCHEMA);
    const game = schedule?.payload.find((candidate) => candidate.season === season && candidate.gameKey === gameKey);
    const espnId = game?.providerIds?.espn;
    if (!game || !isOpaqueId(espnId)) throw new StatusError('provider_unavailable');

    const event = await fetchEvent(espnId);
    const payload = parseEvent(event, season, gameKey, espnId, game);
    const dataUpdatedAt = Date.now();
    try { await writeStatusCache(env.CFB_SCHEDULE_CACHE, statusKey, payload, dataUpdatedAt); } catch { /* cache failure must not hide valid upstream data */ }
    return json(statusResponse(withFreshness(payload, false, false, dataUpdatedAt), false), 200, headers, 'no-store');
  } catch (error) {
    if (cachedSelection.state === 'stale') {
      const payload = withFreshness(cachedSelection.payload, true, true, cachedSelection.envelope.dataUpdatedAt);
      return json(statusResponse(payload, true), 200, headers, 'no-store');
    }
    return json({ success: false, error: error instanceof StatusError ? error.code : 'upstream_error' }, 502, headers, 'no-store');
  }
}

export const handleGameStatusRequest = handleNebraskaGameStatusRequest;

function scheduleKey(season: number) { return `nebraska_schedule_${season}_cfbd_huskers_${SCHEDULE_SCHEMA}`; }

function isOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\s\/\\?#]/.test(value);
}

async function readStatusCache(cache: any, key: string, season: number, gameKey: string): Promise<CachedStatus | null> {
  if (!cache) return null;
  try {
    const parsed = JSON.parse(await cache.get(key));
    if (parsed?.schema !== STATUS_SCHEMA || parsed.season !== season || parsed.gameKey !== gameKey || !parsed.payload || parsed.payload.season !== season || parsed.payload.gameKey !== gameKey || !isStatus(parsed.payload.status) || !Number.isInteger(parsed.payload.nextPollSeconds) || typeof parsed.payload.homeTeam !== 'string' || typeof parsed.payload.awayTeam !== 'string') return null;
    const envelope: CacheEnvelope<StatusPayload> = parsed;
    return Number.isFinite(envelope.dataUpdatedAt) && Number.isFinite(envelope.freshUntil) && Number.isFinite(envelope.retainUntil) && envelope.retainUntil <= envelope.dataUpdatedAt + RETAIN_SECONDS * 1000 ? parsed : null;
  } catch { return null; }
}

function isStatus(value: unknown): value is LiveGameState {
  return value === 'scheduled' || value === 'pre' || value === 'live' || value === 'in_progress' || value === 'final' || value === 'postponed' || value === 'canceled' || value === 'unknown';
}

async function writeStatusCache(cache: any, key: string, payload: StatusPayload, dataUpdatedAt: number) {
  if (!cache) return;
  const ttl = payload.status === 'live' ? LIVE_TTL_SECONDS : OTHER_TTL_SECONDS;
  const value: CachedStatus = { schema: STATUS_SCHEMA, source: 'espn', season: payload.season, gameKey: payload.gameKey, payload, dataUpdatedAt, freshUntil: dataUpdatedAt + ttl * 1000, retainUntil: dataUpdatedAt + RETAIN_SECONDS * 1000 };
  await cache.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, RETAIN_SECONDS) });
}

async function fetchEvent(id: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ESPN_DEADLINE_MS);
  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/summary?event=${encodeURIComponent(id)}`, { signal: controller.signal });
    if (!response.ok) throw new StatusError('upstream_error');
    return await response.json();
  } finally { clearTimeout(timer); }
}

function parseEvent(response: any, season: number, gameKey: string, requestedId: string, canonical: CanonicalScheduleGame): StatusPayload {
  const event = response?.header?.id === requestedId ? response : response?.events?.find((candidate: any) => candidate?.id === requestedId);
  const competition = event?.header?.competitions?.[0] || event?.competitions?.[0];
  const competitors = competition?.competitors;
  const eventId = event?.id || event?.header?.id;
  if (!event || eventId !== requestedId || !Array.isArray(competitors) || competitors.length !== 2) throw new StatusError('invalid_event');
  const nebraska = competitors.find((c: any) => String(c?.team?.id) === '158' || /nebraska/i.test(String(c?.team?.displayName || c?.team?.location || c?.team?.shortDisplayName)));
  const opponent = competitors.find((c: any) => c !== nebraska && matchesOpponent(c, canonical));
  if (!nebraska || !opponent) throw new StatusError('invalid_event');
  const state = String(event?.header?.competitions?.[0]?.status?.type?.state || competition?.status?.type?.state || '').toLowerCase();
  const name = String(event?.header?.competitions?.[0]?.status?.type?.name || competition?.status?.type?.name || '').toLowerCase();
  const text = String(event?.header?.competitions?.[0]?.status?.type?.shortDetail || competition?.status?.type?.shortDetail || competition?.status?.type?.detail || '');
  const status: LiveGameState = /cancel/.test(name + state + text) ? 'canceled' : /postpon/.test(name + state + text) ? 'postponed' : /final|complete/.test(name + state) ? 'final' : /in_progress|inprogress|live/.test(name + state) ? 'live' : /pre/.test(name + state) ? 'pre' : 'scheduled';
  const score = (c: any) => c?.score === undefined || !Number.isFinite(Number(c.score)) ? undefined : Number(c.score);
  const home = competitors.find((c: any) => c?.homeAway === 'home');
  const away = competitors.find((c: any) => c?.homeAway === 'away');
  if (!home || !away) throw new StatusError('invalid_event');
  const result: StatusPayload = { season, gameKey, status, homeTeam: canonical.homeTeam, awayTeam: canonical.awayTeam, nextPollSeconds: status === 'live' ? LIVE_TTL_SECONDS : OTHER_TTL_SECONDS, detail: text || undefined };
  const scores = { nebraska: score(nebraska), opponent: score(opponent) };
  if (scores.nebraska !== undefined || scores.opponent !== undefined) result.score = scores;
  const homeScore = score(home); const awayScore = score(away);
  if (homeScore !== undefined) result.homeScore = homeScore;
  if (awayScore !== undefined) result.awayScore = awayScore;
  const situation = competition?.situation;
  if (situation?.period !== undefined) result.period = String(situation.period);
  if (situation?.displayClock) result.clock = String(situation.displayClock);
  return result;
}

function normalizeTeam(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function matchesOpponent(competitor: any, canonical: CanonicalScheduleGame): boolean {
  const team = competitor?.team;
  if (canonical.opponentId !== undefined && String(team?.id) === String(canonical.opponentId)) return true;
  const canonicalNames = [canonical.opponent, canonical.homeTeam, canonical.awayTeam].map(normalizeTeam).filter(Boolean);
  const providerNames = [team?.displayName, team?.location, team?.shortDisplayName, team?.abbreviation].map(normalizeTeam);
  return providerNames.some((name) => name && canonicalNames.includes(name));
}

function withFreshness(payload: StatusPayload, cached: boolean, stale: boolean, updated: number): StatusPayload {
  return { ...payload, freshness: { cached, stale, source: 'espn', dataUpdatedAt: new Date(updated).toISOString(), servedAt: new Date().toISOString() } };
}

function statusResponse(data: StatusPayload, cached: boolean): LiveGameStatusResponse {
  return { success: true, data, cached, lastUpdated: data.freshness?.dataUpdatedAt ?? new Date().toISOString(), source: 'espn' };
}

class StatusError extends Error { constructor(public code: string) { super(code); } }
function json(body: unknown, status: number, headers: Record<string, string>, cacheControl = 'no-store') { return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Cache-Control': cacheControl } }); }
