// Schedule API for Cloudflare Worker
import { client, getGames, getMedia } from 'cfbd';
const HUSKERS_FOOTBALL_SCHEDULE_ID = 242;
export async function handleScheduleRequest(request, env) {
    const url = new URL(request.url);
    const season = getRequestedSeason(url);
    const CACHE_KEY = `nebraska_schedule_${season}_cfbd_huskers_v5`;
    const CACHE_TTL = 60 * 60 * 6; // 6 hours (schedule info can change)
    const corsHeaders = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }
    try {
        // Check for cached data
        let cachedData = null;
        if (env.SCHEDULE_CACHE) {
            try {
                const cached = await env.SCHEDULE_CACHE.get(CACHE_KEY);
                if (cached) {
                    cachedData = JSON.parse(cached);
                }
            }
            catch (error) {
                console.error('Cache read error:', error);
            }
        }
        // Return cached data if still valid
        if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp) < (CACHE_TTL * 1000)) {
            const response = {
                success: true,
                data: cachedData.data,
                cached: true,
                lastUpdated: new Date(cachedData.timestamp).toISOString(),
                source: cachedData.source,
                count: cachedData.data.length,
                nextRefresh: new Date(cachedData.timestamp + (CACHE_TTL * 1000)).toISOString(),
                season: cachedData.season
            };
            return new Response(JSON.stringify(response), {
                headers: {
                    ...corsHeaders,
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }
        if (!env.CFBD_API_KEY) {
            throw new Error('CFBD_API_KEY is not configured');
        }
        // Fetch fresh data from College Football Data
        let scheduleData = [];
        const dataSource = 'cfbd-api';
        client.setConfig({
            headers: {
                Authorization: `Bearer ${env.CFBD_API_KEY}`
            }
        });
        const [cfbdResponse, mediaResponse, huskerOverrides] = await Promise.all([
            getGames({
                query: {
                    year: season,
                    seasonType: 'regular',
                    team: 'Nebraska'
                }
            }),
            getMedia({
                query: {
                    year: season,
                    seasonType: 'regular',
                    team: 'Nebraska',
                    mediaType: 'tv'
                }
            }).catch((error) => {
                console.error('CFBD media fetch error:', error);
                return { data: [] };
            }),
            fetchHuskerScheduleOverrides(season)
        ]);
        if (cfbdResponse.error) {
            throw new Error(`CFBD API error: ${JSON.stringify(cfbdResponse.error)}`);
        }
        const cfbdGames = Array.isArray(cfbdResponse.data) ? cfbdResponse.data : [];
        const cfbdMedia = Array.isArray(mediaResponse.data) ? mediaResponse.data : [];
        const mediaByGame = createMediaLookup(cfbdMedia);
        scheduleData = applyHuskerOverrides(parseCFBDSchedule(cfbdGames, mediaByGame), huskerOverrides);
        console.log(`Fetched ${scheduleData.length} games from CFBD API for ${season}`);
        // Cache the fresh data
        if (env.SCHEDULE_CACHE && scheduleData.length > 0) {
            try {
                const cacheData = {
                    data: scheduleData,
                    timestamp: Date.now(),
                    source: dataSource,
                    season
                };
                await env.SCHEDULE_CACHE.put(CACHE_KEY, JSON.stringify(cacheData), {
                    expirationTtl: CACHE_TTL
                });
            }
            catch (error) {
                console.error('Cache write error:', error);
            }
        }
        const response = {
            success: true,
            data: scheduleData,
            cached: false,
            lastUpdated: new Date().toISOString(),
            source: dataSource,
            count: scheduleData.length,
            nextRefresh: new Date(Date.now() + (CACHE_TTL * 1000)).toISOString(),
            season
        };
        return new Response(JSON.stringify(response), {
            headers: {
                ...corsHeaders,
                'Cache-Control': 'public, max-age=3600'
            }
        });
    }
    catch (error) {
        console.error('Schedule handler error:', error);
        const response = {
            success: false,
            data: [],
            cached: false,
            source: 'cfbd-api',
            lastUpdated: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unable to load schedule data',
            season
        };
        return new Response(JSON.stringify(response), {
            status: 502,
            headers: {
                ...corsHeaders,
                'Cache-Control': 'no-cache'
            }
        });
    }
}
function getRequestedSeason(url) {
    const requestedSeason = url.searchParams.get('season');
    if (requestedSeason && /^\d{4}$/.test(requestedSeason)) {
        return parseInt(requestedSeason, 10);
    }
    const now = new Date();
    const currentYear = now.getFullYear();
    return now.getMonth() === 0 ? currentYear - 1 : currentYear;
}
async function fetchHuskerScheduleOverrides(season) {
    try {
        const apiUrl = `https://huskers.com/website-api/schedule-events?filter%5Bschedule_id%5D=${HUSKERS_FOOTBALL_SCHEDULE_ID}&filter%5Bhide_from_specific_sport_schedule%5D=false&include=conference.image,opponent.customLogo,opponent.officialLogo,opponentLogo,postEventArticle.image,preEventArticle.image,presentedBy,promotionalItems.image,schedule.sport,scheduleEventLinks.icon,scheduleEventResult,scheduleEventTags.image,secondOpponent.customLogo,secondOpponent.officialLogo,secondOpponentLogo,tournament&per_page=1000&sort=datetime&`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Rhule-aid.com/1.0'
            }
        });
        if (!response.ok) {
            throw new Error(`Huskers schedule API failed: ${response.status}`);
        }
        const payload = await response.json();
        const events = Array.isArray(payload?.data) ? payload.data : [];
        const overrides = new Map();
        for (const event of events) {
            const eventYear = event.datetime ? new Date(event.datetime).getUTCFullYear() : null;
            const opponent = decodeHtml(event.opponent_name || event.opponent?.name || '');
            if (!opponent || /red\/white|spring game/i.test(opponent)) {
                continue;
            }
            if (eventYear !== season) {
                continue;
            }
            const date = formatHuskerDate(event.datetime);
            const time = formatHuskerTime(event.datetime, event.tba, event.tba_text);
            const location = decodeHtml(event.venue || event.location || '');
            const network = extractNetworkFromLinks(event.schedule_event_links || []);
            const opponentLogo = event.opponent_logo?.url || event.opponent?.officialLogo?.url || event.opponent?.customLogo?.url;
            overrides.set(normalizeOpponentKey(opponent), {
                opponent,
                date,
                time,
                ...(location ? { location: normalizeHuskerLocation(location) } : {}),
                network: network || 'TBD',
                ...(opponentLogo ? { opponentLogo } : {})
            });
        }
        return overrides;
    }
    catch (error) {
        console.error('Huskers schedule override error:', error);
        return new Map();
    }
}
function applyHuskerOverrides(games, overrides) {
    return games.map((game) => {
        const override = overrides.get(normalizeOpponentKey(game.opponent));
        if (!override) {
            return game;
        }
        return {
            ...game,
            date: override.date,
            time: override.time,
            ...(override.location ? { location: override.location } : {}),
            network: override.network !== 'TBD' ? override.network : game.network,
            tvNetwork: override.network !== 'TBD' ? override.network : game.tvNetwork,
            ...(override.opponentLogo ? { opponentLogo: override.opponentLogo } : {})
        };
    });
}
function formatHuskerDate(datetime) {
    const date = new Date(datetime);
    if (Number.isNaN(date.getTime())) {
        return 'TBD';
    }
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    });
}
function formatHuskerTime(datetime, tba, tbaText) {
    if (tba) {
        return normalizeHuskerTime(tbaText || 'TBD');
    }
    const date = new Date(datetime);
    if (Number.isNaN(date.getTime()) || isPlaceholderKickoff(date)) {
        return 'TBD';
    }
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'America/Chicago',
        timeZoneName: 'short'
    }).replace(/\s+/g, ' ');
}
function normalizeHuskerTime(time) {
    const trimmed = time.trim();
    return !trimmed || /^TBA$/i.test(trimmed) ? 'TBD' : trimmed;
}
function extractNetworkFromLinks(links) {
    const candidates = links
        .filter((link) => link?.is_tv_translation || link?.icon?.title || link?.title || link?.link)
        .flatMap((link) => [link?.icon?.title, link?.icon?.original_name, link?.icon?.alt, link?.title, link?.label, link?.link])
        .filter((value) => typeof value === 'string');
    for (const candidate of candidates) {
        const network = normalizeNetworkName(candidate);
        if (network) {
            return network;
        }
    }
    return null;
}
function normalizeNetworkName(value) {
    const normalized = decodeHtml(value).replace(/[_-]/g, ' ').trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    if (normalized.includes('btn') || normalized.includes('big ten network'))
        return 'BTN';
    if (normalized.includes('fs1'))
        return 'FS1';
    if (normalized.includes('fox'))
        return 'FOX';
    if (normalized.includes('cbs'))
        return 'CBS';
    if (normalized.includes('nbc'))
        return 'NBC';
    if (normalized.includes('peacock'))
        return 'Peacock';
    if (normalized.includes('espn2'))
        return 'ESPN2';
    if (normalized.includes('espnu'))
        return 'ESPNU';
    if (normalized.includes('espn'))
        return 'ESPN';
    return null;
}
function normalizeOpponentKey(opponent) {
    return opponent
        .toLowerCase()
        .replace(/&amp;/g, '&')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function normalizeHuskerLocation(location) {
    return location
        .replace(/Lincoln, Neb\. \/ Memorial Stadium/i, 'Memorial Stadium (Lincoln, NE)')
        .replace(/East Lansing, Mich\./i, 'Spartan Stadium')
        .replace(/Eugene, Ore\./i, 'Autzen Stadium')
        .replace(/Champaign, Ill\./i, 'Memorial Stadium (Champaign, IL)')
        .replace(/Piscataway, N\.J\./i, 'SHI Stadium')
        .replace(/Iowa City, Iowa/i, 'Kinnick Stadium');
}
function decodeHtml(value) {
    return (value || '')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim();
}
function parseCFBDSchedule(cfbdGames, mediaByGame) {
    return cfbdGames
        .map(game => parseCFBDGame(game, mediaByGame))
        .filter((game) => game !== null)
        .sort((a, b) => new Date(`${a.date} ${a.time === 'TBD' ? '12:00 PM' : a.time}`).getTime() - new Date(`${b.date} ${b.time === 'TBD' ? '12:00 PM' : b.time}`).getTime());
}
function parseCFBDGame(game, mediaByGame) {
    const homeTeam = game.homeTeam || game.home_team;
    const awayTeam = game.awayTeam || game.away_team;
    if (!homeTeam || !awayTeam) {
        return null;
    }
    const isHome = homeTeam === 'Nebraska';
    const opponent = isHome ? awayTeam : homeTeam;
    const homeId = normalizeTeamId(game.homeId ?? game.home_id);
    const awayId = normalizeTeamId(game.awayId ?? game.away_id);
    const opponentId = isHome ? awayId : homeId;
    const gameId = normalizeTeamId(game.id);
    const startDate = game.startDate || game.start_date;
    const gameDate = startDate ? new Date(startDate) : null;
    const hasAnnouncedKickoff = gameDate && !isPlaceholderKickoff(gameDate);
    const date = gameDate && !isNaN(gameDate.getTime())
        ? formatGameDate(gameDate, Boolean(hasAnnouncedKickoff))
        : 'TBD';
    const time = hasAnnouncedKickoff
        ? gameDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/Chicago'
        }).replace(/\s+/g, ' ')
        : 'TBD';
    const homePoints = game.homePoints ?? game.home_points;
    const awayPoints = game.awayPoints ?? game.away_points;
    const nebraskaScore = isHome ? homePoints : awayPoints;
    const opponentScore = isHome ? awayPoints : homePoints;
    let result;
    let score;
    if (typeof nebraskaScore === 'number' && typeof opponentScore === 'number') {
        if (nebraskaScore > opponentScore) {
            result = 'W';
        }
        else if (opponentScore > nebraskaScore) {
            result = 'L';
        }
        score = `${nebraskaScore}-${opponentScore}`;
    }
    const network = getTVNetwork(game, mediaByGame);
    return {
        ...(gameId ? { id: gameId } : {}),
        date,
        opponent,
        ...(opponentId ? { opponentId } : {}),
        homeTeam,
        awayTeam,
        ...(homeId ? { homeTeamId: homeId } : {}),
        ...(awayId ? { awayTeamId: awayId } : {}),
        nebraskaLogo: getLogoUrl('Nebraska', isHome ? homeId : awayId),
        opponentLogo: getLogoUrl(opponent, opponentId),
        time,
        location: game.venue || 'TBA',
        network,
        tvNetwork: network,
        isHome,
        isNeutral: game.neutralSite === true || game.neutral_site === true,
        result,
        score
    };
}
function createMediaLookup(media) {
    const lookup = new Map();
    for (const item of media) {
        const outlet = normalizeOutlet(item.outlet);
        if (!outlet) {
            continue;
        }
        if (item.id) {
            lookup.set(`id:${item.id}`, outlet);
        }
        const homeTeam = item.homeTeam || item.home_team;
        const awayTeam = item.awayTeam || item.away_team;
        const startTime = item.startTime || item.start_time;
        if (homeTeam && awayTeam) {
            lookup.set(`teams:${homeTeam}|${awayTeam}`, outlet);
        }
        if (homeTeam && awayTeam && startTime) {
            lookup.set(`full:${homeTeam}|${awayTeam}|${startTime}`, outlet);
        }
    }
    return lookup;
}
function getTVNetwork(game, mediaByGame) {
    const inlineTV = normalizeOutlet(game.tv || game.tvNetwork || game.tv_network || game.broadcast || game.network);
    if (inlineTV) {
        return inlineTV;
    }
    const gameId = game.id;
    if (gameId && mediaByGame.has(`id:${gameId}`)) {
        return mediaByGame.get(`id:${gameId}`) || 'TBD';
    }
    const homeTeam = game.homeTeam || game.home_team;
    const awayTeam = game.awayTeam || game.away_team;
    const startTime = game.startDate || game.start_date;
    if (homeTeam && awayTeam && startTime && mediaByGame.has(`full:${homeTeam}|${awayTeam}|${startTime}`)) {
        return mediaByGame.get(`full:${homeTeam}|${awayTeam}|${startTime}`) || 'TBD';
    }
    if (homeTeam && awayTeam && mediaByGame.has(`teams:${homeTeam}|${awayTeam}`)) {
        return mediaByGame.get(`teams:${homeTeam}|${awayTeam}`) || 'TBD';
    }
    return 'TBD';
}
function normalizeOutlet(outlet) {
    if (typeof outlet !== 'string') {
        return null;
    }
    const normalized = outlet.trim();
    return normalized && normalized.toUpperCase() !== 'TBD' ? normalized : null;
}
function getLogoUrl(teamName, teamId) {
    if (teamId) {
        return `/api/logo?teamId=${teamId}&size=128`;
    }
    return `/api/logo?team=${encodeURIComponent(teamName)}&size=128`;
}
function formatGameDate(gameDate, hasAnnouncedKickoff) {
    return gameDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: hasAnnouncedKickoff ? 'America/Chicago' : 'UTC'
    });
}
function isPlaceholderKickoff(gameDate) {
    // CFBD commonly stores future unannounced games at midnight UTC.
    // Treat those as date-only games so they do not show as misleading late-night kickoffs.
    return gameDate.getUTCMinutes() === 0 && [0, 4, 5].includes(gameDate.getUTCHours());
}
function normalizeTeamId(teamId) {
    if (typeof teamId === 'number' && Number.isFinite(teamId)) {
        return teamId;
    }
    if (typeof teamId === 'string' && /^\d+$/.test(teamId)) {
        return parseInt(teamId, 10);
    }
    return undefined;
}
