// CFB Schedule API for Cloudflare Worker
export async function handleCFBRequest(request, env) {
    const url = new URL(request.url);
    const week = url.searchParams.get('week');
    const date = url.searchParams.get('date');
    const group = url.searchParams.get('groups') || url.searchParams.get('group') || '80'; // Default to FBS
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
        // Build cache key based on parameters
        const cacheKey = `cfb-schedule-${group}-${week || 'current'}-${date || 'today'}`;
        const CACHE_TTL = 60 * 30; // 30 minutes for live games
        // Check cache
        let cachedData = null;
        if (env.SCHEDULE_CACHE) {
            try {
                const cached = await env.SCHEDULE_CACHE.get(cacheKey);
                if (cached) {
                    cachedData = JSON.parse(cached);
                    if (cachedData.timestamp && (Date.now() - cachedData.timestamp) < (CACHE_TTL * 1000)) {
                        const response = {
                            success: true,
                            data: cachedData.data,
                            cached: true,
                            lastUpdated: new Date(cachedData.timestamp).toISOString(),
                            count: cachedData.data.length,
                            week: cachedData.week,
                            date: cachedData.date
                        };
                        return new Response(JSON.stringify(response), {
                            headers: {
                                ...corsHeaders,
                                'Cache-Control': 'public, max-age=1800' // 30 minutes
                            }
                        });
                    }
                }
            }
            catch (error) {
                console.error('Cache read error:', error);
            }
        }
        // Build ESPN API URL
        let espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=${group}`;
        if (week)
            espnUrl += `&week=${week}`;
        if (date)
            espnUrl += `&dates=${date}`;
        // Fetch from ESPN API
        const response = await fetch(espnUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Rhule-aid/1.0)',
            }
        });
        if (!response.ok) {
            throw new Error(`ESPN API error: ${response.status}`);
        }
        const espnData = await response.json();
        const games = [];
        // Parse ESPN data
        if (espnData.events && Array.isArray(espnData.events)) {
            for (const event of espnData.events) {
                try {
                    const competition = event.competitions[0];
                    if (!competition)
                        continue;
                    const homeCompetitor = competition.competitors.find((c) => c.homeAway === 'home');
                    const awayCompetitor = competition.competitors.find((c) => c.homeAway === 'away');
                    if (!homeCompetitor || !awayCompetitor)
                        continue;
                    const gameDate = new Date(competition.date);
                    const game = {
                        id: event.id,
                        date: competition.date, // Keep raw ISO date string for frontend timezone conversion
                        time: gameDate.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZoneName: 'short'
                        }),
                        homeTeam: {
                            id: homeCompetitor.team.id,
                            name: homeCompetitor.team.name,
                            displayName: homeCompetitor.team.displayName,
                            abbreviation: homeCompetitor.team.abbreviation,
                            logo: homeCompetitor.team.logo,
                            color: homeCompetitor.team.color,
                            score: homeCompetitor.score,
                            record: homeCompetitor.records?.[0]?.summary
                        },
                        awayTeam: {
                            id: awayCompetitor.team.id,
                            name: awayCompetitor.team.name,
                            displayName: awayCompetitor.team.displayName,
                            abbreviation: awayCompetitor.team.abbreviation,
                            logo: awayCompetitor.team.logo,
                            color: awayCompetitor.team.color,
                            score: awayCompetitor.score,
                            record: awayCompetitor.records?.[0]?.summary
                        },
                        venue: {
                            name: competition.venue?.fullName || 'TBA',
                            city: competition.venue?.address?.city || '',
                            state: competition.venue?.address?.state || ''
                        },
                        status: {
                            state: competition.status.type.state,
                            detail: competition.status.type.detail,
                            completed: competition.status.type.completed,
                            inProgress: competition.status.type.state === 'in'
                        },
                        broadcasts: competition.broadcasts?.map((b) => b.names?.join(', ') || '').filter(Boolean) || [],
                        neutralSite: competition.neutralSite || false,
                        conference: competition.conferenceCompetition || false
                    };
                    // Extract betting odds if available
                    if (competition.odds && competition.odds.length > 0) {
                        const oddsData = competition.odds[0]; // Use first provider (typically ESPN BET)
                        game.odds = {
                            provider: oddsData.provider?.name || 'ESPN BET',
                            spread: {
                                home: oddsData.pointSpread?.home?.close?.line || '',
                                away: oddsData.pointSpread?.away?.close?.line || ''
                            },
                            moneyline: {
                                home: oddsData.moneyline?.home?.close?.odds || '',
                                away: oddsData.moneyline?.away?.close?.odds || ''
                            },
                            total: oddsData.overUnder?.toString() || '',
                            details: oddsData.details || ''
                        };
                    }
                    games.push(game);
                }
                catch (error) {
                    console.error('Error parsing game:', error);
                    continue;
                }
            }
        }
        // Sort games by date/time
        games.sort((a, b) => new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime());
        // Cache the result
        if (env.SCHEDULE_CACHE && games.length > 0) {
            try {
                const cacheData = {
                    data: games,
                    timestamp: Date.now(),
                    week: espnData.week?.number,
                    date: date
                };
                await env.SCHEDULE_CACHE.put(cacheKey, JSON.stringify(cacheData), {
                    expirationTtl: CACHE_TTL
                });
            }
            catch (error) {
                console.error('Cache write error:', error);
            }
        }
        const finalResponse = {
            success: true,
            data: games,
            cached: false,
            lastUpdated: new Date().toISOString(),
            count: games.length,
            week: espnData.week?.number,
            date: date || undefined
        };
        return new Response(JSON.stringify(finalResponse), {
            headers: {
                ...corsHeaders,
                'Cache-Control': 'public, max-age=1800' // 30 minutes
            }
        });
    }
    catch (error) {
        console.error('CFB API error:', error);
        const errorResponse = {
            success: false,
            data: [],
            cached: false,
            lastUpdated: new Date().toISOString(),
            count: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: corsHeaders
        });
    }
}
