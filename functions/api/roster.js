// Cloudflare Pages Function to scrape roster data with KV caching
export async function onRequest(context) {
    const { request, env } = context;
    
    const CACHE_KEY = 'nebraska_roster_2025';
    const CACHE_TTL = 60 * 60 * 12; // 12 hours in seconds
    
    try {
        // Try to get cached data first
        let cachedData = null;
        if (env.ROSTER_CACHE) {
            try {
                const cached = await env.ROSTER_CACHE.get(CACHE_KEY);
                if (cached) {
                    cachedData = JSON.parse(cached);
                    console.log('Found cached roster data');
                }
            } catch (error) {
                console.log('Cache read error:', error);
            }
        }
        
        // If we have cached data and it's not too old, return it
        if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp) < (CACHE_TTL * 1000)) {
            return new Response(JSON.stringify({
                success: true,
                data: cachedData.data,
                cached: true,
                lastUpdated: new Date(cachedData.timestamp).toISOString(),
                source: 'cache',
                count: cachedData.data.length
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }

        console.log('Fetching fresh roster data from huskers.com...');
        
        const rosterPageResponse = await fetch('https://huskers.com/sports/football/roster', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (!rosterPageResponse.ok) {
            throw new Error(`Failed to fetch roster page: ${rosterPageResponse.status}`);
        }
        
        const html = await rosterPageResponse.text();
        const players = [];
        
        // Extract all players using the comprehensive pattern
        const detailedPattern = /<td class="roster-table-cell"><span>(\d+)<\/span><\/td><!--\]--><!--\[--><th scope="row" class="roster-table-cell"><div><a href="\/sports\/football\/roster\/player\/[^"]*" class="table__roster-name"><span>([^<]+)<\/span><\/a>.*?<\/th><!--\]--><!--\[--><td class="roster-table-cell"><span>([^<]*)<\/span><\/td><!--\]--><!--\[--><td class="roster-table-cell"><span>([^<]*)<\/span><\/td><!--\]--><!--\[--><td class="roster-table-cell"><span>([^<]*)<\/span><\/td><!--\]--><!--\[--><td class="roster-table-cell"><span>([^<]*)<\/span><\/td><!--\]--><!--\[--><td class="roster-table-cell"><span>([^<]*)<\/span><\/td>/g;
        
        let match;
        while ((match = detailedPattern.exec(html)) !== null) {
            const [, number, name, position, height, weight, classYear, hometown] = match;
            
            if (name && name.trim() && number) {
                // Convert position to abbreviation for JavaScript compatibility
                let positionAbbr = position.trim();
                if (position.includes('Quarterback')) positionAbbr = 'QB';
                else if (position.includes('Running Back')) positionAbbr = 'RB';
                else if (position.includes('Wide Receiver')) positionAbbr = 'WR';
                else if (position.includes('Tight End')) positionAbbr = 'TE';
                else if (position.includes('Offensive Lineman')) positionAbbr = 'OL';
                else if (position.includes('Linebacker')) positionAbbr = 'LB';
                else if (position.includes('Defensive Back')) positionAbbr = 'DB';
                else if (position.includes('Defensive Lineman')) positionAbbr = 'DL';
                else if (position.includes('Place Kicker')) positionAbbr = 'K';
                else if (position.includes('Punter')) positionAbbr = 'P';
                else if (position.includes('Long Snapper')) positionAbbr = 'LS';
                
                players.push({
                    number: number.trim(),
                    name: name.trim(),
                    position: positionAbbr,
                    class: classYear ? classYear.trim() : 'N/A',
                    height: height ? height.trim() : 'N/A',
                    weight: weight ? weight.replace(/\s*lbs\s*/, '').trim() : 'N/A',
                    hometown: hometown ? hometown.trim() : 'N/A'
                });
            }
        }
        
        // Sort players by jersey number
        players.sort((a, b) => {
            const numA = parseInt(a.number) || 999;
            const numB = parseInt(b.number) || 999;
            return numA - numB;
        });

        // Cache the fresh data
        if (env.ROSTER_CACHE && players.length > 0) {
            try {
                await env.ROSTER_CACHE.put(CACHE_KEY, JSON.stringify({
                    data: players,
                    timestamp: Date.now()
                }), { expirationTtl: CACHE_TTL });
                console.log(`Cached ${players.length} players to ROSTER_CACHE`);
            } catch (error) {
                console.log('Cache write error:', error);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            data: players,
            cached: false,
            lastUpdated: new Date().toISOString(),
            count: players.length,
            source: 'web_scrape_fresh'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=3600'
            }
        });
        
    } catch (error) {
        console.error('Error fetching roster data:', error);
        
        // Try to return stale cached data if available
        if (cachedData && cachedData.data) {
            console.log('Returning stale cached data due to error');
            return new Response(JSON.stringify({
                success: true,
                data: cachedData.data,
                cached: true,
                stale: true,
                lastUpdated: new Date(cachedData.timestamp).toISOString(),
                source: 'stale-cache'
            }), {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Cache-Control': 'public, max-age=300'
                }
            });
        }

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            data: []
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
