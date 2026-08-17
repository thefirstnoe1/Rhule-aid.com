import { readRetainedScheduleCache } from '../lib/schedule-cache';
import type { CanonicalScheduleGame } from '../contracts/gameday';
import { generateGameIcal } from '../lib/ical';

const CACHE_SCHEMA = 'v7';
const SEASON_PATTERN = /^\d{4}$/;
const GAME_KEY_PATTERN = /^[a-z0-9]+(?::[a-z0-9][a-z0-9 _-]*)+$/i;
const MAX_GAME_KEY_LENGTH = 128;

function errorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function handleGameCalendarRequest(request: Request, env: any): Promise<Response> {
  if (request.method !== 'GET') return errorResponse(405, 'Method not allowed');
  const url = new URL(request.url);
  const seasonText = url.searchParams.get('season') || '';
  const gameKey = url.searchParams.get('gameKey') || '';
  if (!SEASON_PATTERN.test(seasonText)) return errorResponse(400, 'Invalid season');
  if (gameKey.length > MAX_GAME_KEY_LENGTH || !GAME_KEY_PATTERN.test(gameKey)) return errorResponse(400, 'Invalid gameKey');

  const season = Number(seasonText);
  if (season < 1900 || season > 2100) return errorResponse(400, 'Invalid season');
  const cacheKey = `nebraska_schedule_${season}_cfbd_huskers_${CACHE_SCHEMA}`;
  const cached = await readRetainedScheduleCache(env.SCHEDULE_CACHE, cacheKey, CACHE_SCHEMA);
  const game = cached?.season === season
    ? cached.payload.find((candidate) => candidate.gameKey === gameKey)
    : undefined;
  if (!game) return errorResponse(404, 'Game not found');
  if (game.kickoffStatus !== 'confirmed' || !game.kickoffAt || !game.homeTeam || !game.awayTeam) {
    return errorResponse(409, 'Game kickoff is not confirmed');
  }
  try {
    const body = generateGameIcal(game as CanonicalScheduleGame);
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="rhule-aid-games.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return errorResponse(422, 'Game kickoff is invalid');
  }
}

export const onRequest = handleGameCalendarRequest;
