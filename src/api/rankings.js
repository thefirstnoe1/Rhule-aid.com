export async function handleRankingsRequest(request, env, pollType) {
    const CACHE_KEY = `rankings_${pollType.toLowerCase()}_mock`;
    const CACHE_TTL = 60 * 60 * 6; // 6 hours
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
        if (env.RANKINGS_CACHE) {
            try {
                const cached = await env.RANKINGS_CACHE.get(CACHE_KEY);
                if (cached) {
                    cachedData = JSON.parse(cached);
                }
            }
            catch (error) {
                console.error('Rankings cache read error:', error);
            }
        }
        // Return cached data if still valid
        if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp) < (CACHE_TTL * 1000)) {
            const response = {
                success: true,
                teams: cachedData.teams,
                cached: true,
                lastUpdated: new Date(cachedData.timestamp).toISOString(),
                source: cachedData.source,
                poll_type: pollType
            };
            return new Response(JSON.stringify(response), {
                headers: {
                    ...corsHeaders,
                    'Cache-Control': 'public, max-age=21600'
                }
            });
        }
        // Generate mock rankings data
        const rankings = getMockRankings(pollType);
        // Cache the data
        if (env.RANKINGS_CACHE && rankings.length > 0) {
            try {
                const cacheData = {
                    teams: rankings,
                    timestamp: Date.now(),
                    source: 'mock-data'
                };
                await env.RANKINGS_CACHE.put(CACHE_KEY, JSON.stringify(cacheData), {
                    expirationTtl: CACHE_TTL
                });
            }
            catch (error) {
                console.error('Rankings cache write error:', error);
            }
        }
        const response = {
            success: true,
            teams: rankings,
            cached: false,
            lastUpdated: new Date().toISOString(),
            source: 'mock-data',
            poll_type: pollType
        };
        return new Response(JSON.stringify(response), {
            headers: {
                ...corsHeaders,
                'Cache-Control': 'public, max-age=21600'
            }
        });
    }
    catch (error) {
        console.error('Rankings handler error:', error);
        const response = {
            success: false,
            teams: [],
            cached: false,
            lastUpdated: new Date().toISOString(),
            source: 'error',
            error: 'Failed to fetch rankings'
        };
        return new Response(JSON.stringify(response), {
            status: 500,
            headers: corsHeaders
        });
    }
}
function getMockRankings(_pollType) {
    // Mock Top 25 rankings for 2025 season
    // Note: _pollType could be used to differentiate between AP/CFP rankings
    const mockTeams = [
        { rank: 1, school: 'Georgia', points: 1625 },
        { rank: 2, school: 'Texas', points: 1559 },
        { rank: 3, school: 'Oregon', points: 1488 },
        { rank: 4, school: 'Alabama', points: 1421 },
        { rank: 5, school: 'Ohio State', points: 1367 },
        { rank: 6, school: 'Notre Dame', points: 1298 },
        { rank: 7, school: 'Penn State', points: 1234 },
        { rank: 8, school: 'Michigan', points: 1187 },
        { rank: 9, school: 'FSU', points: 1123 },
        { rank: 10, school: 'USC', points: 1076 },
        { rank: 11, school: 'Utah', points: 1021 },
        { rank: 12, school: 'Miami', points: 978 },
        { rank: 13, school: 'LSU', points: 923 },
        { rank: 14, school: 'Clemson', points: 887 },
        { rank: 15, school: 'Tennessee', points: 834 },
        { rank: 16, school: 'Oklahoma', points: 789 },
        { rank: 17, school: 'Kansas State', points: 743 },
        { rank: 18, school: 'Wisconsin', points: 698 },
        { rank: 19, school: 'North Carolina', points: 654 },
        { rank: 20, school: 'Washington', points: 612 },
        { rank: 21, school: 'Florida', points: 567 },
        { rank: 22, school: 'UCLA', points: 523 },
        { rank: 23, school: 'Ole Miss', points: 478 },
        { rank: 24, school: 'Iowa', points: 434 },
        { rank: 25, school: 'Minnesota', points: 389 }
    ];
    return mockTeams;
}
