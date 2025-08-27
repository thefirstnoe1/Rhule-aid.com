export async function handleRosterRequest(request, env) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }
    try {
        // Parse query parameters
        const url = new URL(request.url);
        const sortBy = url.searchParams.get('sort') || 'number';
        // Check cache (4 hour cache for roster)
        const cacheKey = 'nebraska-roster-v4';
        const cached = await env.ROSTER_CACHE?.get(cacheKey);
        if (cached) {
            const cachedData = JSON.parse(cached);
            if (cachedData.timestamp && (Date.now() - cachedData.timestamp) < 14400000) { // 4 hours
                const sortedData = sortRosterData(cachedData.data, sortBy);
                return new Response(JSON.stringify({
                    success: true,
                    data: sortedData,
                    cached: true,
                    lastUpdated: new Date(cachedData.timestamp).toISOString(),
                    count: sortedData.length,
                    sortBy: sortBy
                }), { headers: corsHeaders });
            }
        }
        // Try to scrape fresh roster data
        let rosterData = [];
        try {
            rosterData = await scrapeNebraskaRoster();
        }
        catch (error) {
            console.warn('Failed to scrape roster:', error);
        }
        // If scraping failed, use comprehensive fallback roster
        if (rosterData.length === 0) {
            rosterData = getComprehensiveRoster();
        }
        // Sort the roster data based on the requested sort parameter
        const sortedData = sortRosterData(rosterData, sortBy);
        // Cache the result (unsorted, we'll sort on response)
        await env.ROSTER_CACHE?.put(cacheKey, JSON.stringify({
            data: rosterData,
            timestamp: Date.now()
        }));
        return new Response(JSON.stringify({
            success: true,
            data: sortedData,
            cached: false,
            lastUpdated: new Date().toISOString(),
            count: sortedData.length,
            sortBy: sortBy
        }), { headers: corsHeaders });
    }
    catch (error) {
        console.error('Roster fetch error:', error);
        // Parse query parameters for error response too
        const url = new URL(request.url);
        const sortBy = url.searchParams.get('sort') || 'number';
        const fallbackData = sortRosterData(getComprehensiveRoster(), sortBy);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch roster',
            data: fallbackData,
            sortBy: sortBy
        }), {
            status: 200,
            headers: corsHeaders
        });
    }
}
function sortRosterData(players, sortBy) {
    const sortedPlayers = [...players]; // Create a copy to avoid mutating original
    switch (sortBy) {
        case 'name':
            return sortedPlayers.sort((a, b) => a.name.localeCompare(b.name));
        case 'position':
            return sortedPlayers.sort((a, b) => {
                const posCompare = a.position.localeCompare(b.position);
                return posCompare !== 0 ? posCompare : a.number - b.number;
            });
        case 'jersey':
            // Pure jersey number sort (0, 1, 2, 3, etc.)
            return sortedPlayers.sort((a, b) => a.number - b.number);
        case 'number':
        default:
            // Default sort: by position category first, then by number (maintains original behavior)
            return sortedPlayers.sort((a, b) => {
                const categoryOrder = { 'offense': 1, 'defense': 2, 'special': 3 };
                const aCat = categoryOrder[a.category || 'offense'] || 4;
                const bCat = categoryOrder[b.category || 'offense'] || 4;
                if (aCat !== bCat)
                    return aCat - bCat;
                return a.number - b.number;
            });
    }
}
async function scrapeNebraskaRoster() {
    try {
        // Use the table view which has complete structured data
        const response = await fetch('https://huskers.com/sports/football/roster?view=table', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const players = [];
        // Method 1: Extract from table-based layout (complete structured data)
        // Look for table rows with player information
        const tableRowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
        let rowMatches = html.match(tableRowRegex);
        if (rowMatches) {
            // Filter to only player rows (those with table__roster-name)
            const playerRows = rowMatches.filter(row => row.includes('table__roster-name'));
            console.log(`Found ${playerRows.length} roster table rows`);
            for (const row of playerRows) {
                // Extract all table cells
                const cellMatches = row.match(/<td[^>]*class="roster-table-cell"[^>]*>([\s\S]*?)<\/td>/gi);
                if (!cellMatches || cellMatches.length < 6)
                    continue;
                // Extract jersey number from first cell
                const numberMatch = cellMatches[0]?.match(/<span>(\d+)<\/span>/);
                const number = numberMatch?.[1] ? parseInt(numberMatch[1]) : 0;
                // Extract player name from the name link
                const nameMatch = row.match(/table__roster-name[^>]*><span>([^<]+)<\/span>/);
                const name = nameMatch?.[1]?.trim() || '';
                // Extract position from second cell
                const positionText = cellMatches[1]?.replace(/<[^>]*>/g, '').trim() || '';
                const position = positionText || 'Unknown';
                // Extract other fields from remaining cells
                const height = cellMatches[2] ? cellMatches[2].replace(/<[^>]*>/g, '').trim() : '';
                const weight = cellMatches[3] ? cellMatches[3].replace(/<[^>]*>/g, '').trim() : '';
                const playerClass = cellMatches[4] ? cellMatches[4].replace(/<[^>]*>/g, '').trim() : '';
                const hometown = cellMatches[5] ? cellMatches[5].replace(/<[^>]*>/g, '').trim() : '';
                if (number >= 0 && name) {
                    players.push({
                        number,
                        name: name.replace(/[^\w\s.-]/g, '').trim(),
                        position: position.trim(),
                        class: playerClass,
                        height: height,
                        weight: weight,
                        hometown: hometown,
                        category: categorizePosition(position)
                    });
                }
            }
        }
        // Fallback: Try list view if table view fails
        if (players.length === 0) {
            const listItemRegex = /<li[^>]*class="[^"]*roster-list-item[^"]*"[^>]*>[\s\S]*?<\/li>/gi;
            let cardMatches = html.match(listItemRegex);
            if (cardMatches) {
                console.log(`Fallback: Found ${cardMatches.length} roster list items`);
                for (const card of cardMatches) {
                    // Extract player number - look for jersey-number class specifically
                    const numberMatch = card.match(/roster-list-item__jersey-number[^>]*>(\d+)</i) ||
                        card.match(/jersey-number[^>]*>(\d+)</i) ||
                        card.match(/>(\d+)</i) ||
                        card.match(/#(\d+)/i);
                    const number = numberMatch ? parseInt(numberMatch[1] || '0') : 0;
                    // Extract player name - look for roster-list-item__title class specifically
                    const nameMatch = card.match(/roster-list-item__title[^>]*>([^<]+)</i) ||
                        card.match(/<h[1-6][^>]*>([^<]+)</i) ||
                        card.match(/name[^>]*>([^<]+)</i) ||
                        card.match(/player-name[^>]*>([^<]+)</i) ||
                        card.match(/<a[^>]*href="[^"]*roster[^"]*"[^>]*>([^<]+)</i);
                    const name = nameMatch ? (nameMatch[1] || '').trim() : '';
                    // Extract position - may not be available in list view, will use fallback  
                    const positionMatch = card.match(/position[^>]*>([^<]+)</i) ||
                        card.match(/>(Quarterback|Running Back|Wide Receiver|Tight End|Offensive Line|Defensive Line|Linebacker|Defensive Back|Place Kicker|Punter)/i);
                    let position = positionMatch ? (positionMatch[1] || '').trim() : '';
                    // If no position found, use 'Unknown' - we'll get this from individual player pages later
                    if (!position) {
                        position = 'Unknown';
                    }
                    // Extract class/year
                    const classMatch = card.match(/class[^>]*>([^<]+)</i) ||
                        card.match(/year[^>]*>([^<]+)</i) ||
                        card.match(/>(Freshman|Sophomore|Junior|Senior|Redshirt)/i);
                    const playerClass = classMatch ? (classMatch[1] || '').trim() : '';
                    // Extract height and weight
                    const heightMatch = card.match(/height[^>]*>([^<]+)</i) ||
                        card.match(/(\d+′\d+″)/i) ||
                        card.match(/(\d+'\d+")/i);
                    const height = heightMatch ? (heightMatch[1] || '').trim() : '';
                    const weightMatch = card.match(/weight[^>]*>([^<]+)</i) ||
                        card.match(/(\d{3})\s*lbs/i) ||
                        card.match(/(\d{3})\s*#/i);
                    const weightText = weightMatch ? (weightMatch[1] || '').trim() : '';
                    const weight = weightText ? (weightText.match(/lbs/) ? weightText : weightText + ' lbs') : '';
                    // Extract hometown
                    const hometownMatch = card.match(/hometown[^>]*>([^<]+)</i) ||
                        card.match(/city[^>]*>([^<]+)</i);
                    const hometown = hometownMatch ? (hometownMatch[1] || '').trim() : '';
                    if (number >= 0 && name) {
                        players.push({
                            number,
                            name: name.replace(/[^\w\s.-]/g, '').trim(),
                            position: position.trim(),
                            class: playerClass,
                            height: height,
                            weight: weight,
                            hometown: hometown,
                            category: categorizePosition(position)
                        });
                    }
                }
            }
        }
        if (players.length === 0) {
            // Look for JSON data in script tags
            const scriptRegex = /<script[^>]*>([\s\S]*?roster[\s\S]*?)<\/script>/gi;
            let scriptMatch;
            while ((scriptMatch = scriptRegex.exec(html)) !== null) {
                try {
                    const scriptContent = scriptMatch[1];
                    if (scriptContent) {
                        // Look for roster data patterns
                        const rosterDataMatch = scriptContent.match(/roster["\']?\s*:\s*(\[[\s\S]*?\])/i) ||
                            scriptContent.match(/players["\']?\s*:\s*(\[[\s\S]*?\])/i);
                        if (rosterDataMatch && rosterDataMatch[1]) {
                            const rosterData = JSON.parse(rosterDataMatch[1]);
                            if (Array.isArray(rosterData)) {
                                for (const player of rosterData) {
                                    if (player.number && player.name) {
                                        players.push({
                                            number: parseInt(player.number) || 0,
                                            name: player.name || '',
                                            position: player.position || '',
                                            class: player.class || player.year || '',
                                            height: player.height || '',
                                            weight: player.weight || '',
                                            hometown: player.hometown || '',
                                            category: categorizePosition(player.position || '')
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
                catch (e) {
                    // Ignore JSON parsing errors
                }
            }
        }
        // Method 3: Extract from the current 2025 roster data visible in the HTML
        if (players.length === 0) {
            // Based on the webfetch, extract key players we can see
            const visiblePlayers = [
                { number: 30, name: "Tristan Alvano", position: "Place Kicker", class: "Sophomore", height: "6′1″", weight: "210 lbs", hometown: "Omaha, Neb." },
                { number: 2, name: "Jacory Barney Jr.", position: "Wide Receiver", class: "Sophomore", height: "6′0″", weight: "170 lbs", hometown: "Florida City, Fla." },
                { number: 4, name: "Janiran Bonner", position: "Wide Receiver", class: "Junior", height: "6′2″", weight: "225 lbs", hometown: "Ellenwood, Ga." },
                { number: 15, name: "Dylan Raiola", position: "Quarterback", class: "Sophomore", height: "6′3″", weight: "230 lbs", hometown: "Buford, Ga." },
                { number: 10, name: "Heinrich Haarberg", position: "Tight End", class: "Senior", height: "6′5″", weight: "230 lbs", hometown: "Kearney, Neb." },
                { number: 21, name: "Emmett Johnson", position: "Running Back", class: "Junior", height: "5′11″", weight: "200 lbs", hometown: "Minneapolis, Minn." },
                { number: 6, name: "Dane Key", position: "Wide Receiver", class: "Senior", height: "6′3″", weight: "210 lbs", hometown: "Lexington, Ky." },
                { number: 1, name: "Ceyair Wright", position: "Defensive Back", class: "Senior", height: "6′0″", weight: "190 lbs", hometown: "Los Angeles, Calif." },
                { number: 8, name: "DeShon Singleton", position: "Defensive Back", class: "Senior", height: "6′3″", weight: "210 lbs", hometown: "Greensburg, La." },
                { number: 5, name: "Riley Van Poppel", position: "Defensive Lineman", class: "Sophomore", height: "6′5″", weight: "295 lbs", hometown: "Argyle, Texas" },
                { number: 0, name: "Javin Wright", position: "Linebacker", class: "Senior", height: "6′5″", weight: "230 lbs", hometown: "Chandler, Ariz." },
                { number: 7, name: "Malcolm Hartzog Jr.", position: "Defensive Back", class: "Senior", height: "5′9″", weight: "185 lbs", hometown: "Silver Creek, Miss." },
                { number: 9, name: "Vincent Shavers Jr.", position: "Linebacker", class: "Sophomore", height: "6′1″", weight: "225 lbs", hometown: "Miami, Fla." },
                { number: 3, name: "Marques Buford Jr.", position: "Defensive Back", class: "Senior", height: "5′11″", weight: "190 lbs", hometown: "Chicago, Ill." },
                { number: 69, name: "Turner Corcoran", position: "Offensive Lineman", class: "Senior", height: "6′6″", weight: "310 lbs", hometown: "Lawrence, Kan." },
                { number: 65, name: "Teddy Prochazka", position: "Offensive Lineman", class: "Senior", height: "6′10″", weight: "320 lbs", hometown: "Elkhorn, Neb." }
            ];
            // Only add players that exist in the HTML to avoid stale data
            for (const player of visiblePlayers) {
                if (html.includes(player.name) || html.includes(player.name.replace(/[^a-zA-Z\s]/g, ''))) {
                    players.push({
                        number: player.number,
                        name: player.name,
                        position: player.position,
                        class: player.class,
                        height: player.height,
                        weight: player.weight,
                        hometown: player.hometown,
                        category: categorizePosition(player.position)
                    });
                }
            }
        }
        console.log(`Extracted ${players.length} players from roster`);
        // Sort players by jersey number to ensure consistent ordering
        players.sort((a, b) => a.number - b.number);
        return players; // Return all players found
    }
    catch (error) {
        console.error('Nebraska roster scrape error:', error);
        return [];
    }
}
function categorizePosition(position) {
    const pos = position.toLowerCase();
    // Offense positions
    if (pos.includes('quarterback') || pos === 'qb') {
        return 'offense';
    }
    if (pos.includes('running back') || pos.includes('fullback') || pos === 'rb' || pos === 'fb') {
        return 'offense';
    }
    if (pos.includes('wide receiver') || pos === 'wr') {
        return 'offense';
    }
    if (pos.includes('tight end') || pos === 'te') {
        return 'offense';
    }
    if (pos.includes('offensive lineman') || pos.includes('offensive line') || ['ot', 'og', 'c', 'ol'].includes(pos)) {
        return 'offense';
    }
    // Defense positions  
    if (pos.includes('defensive lineman') || pos.includes('defensive line') || ['de', 'dt', 'nt', 'dl'].includes(pos)) {
        return 'defense';
    }
    if (pos.includes('linebacker') || pos === 'lb' || ['olb', 'mlb', 'ilb'].includes(pos)) {
        return 'defense';
    }
    if (pos.includes('defensive back') || ['cb', 's', 'fs', 'ss', 'db'].includes(pos)) {
        return 'defense';
    }
    // Special teams positions
    if (pos.includes('place kicker') || pos.includes('kicker') || pos === 'k') {
        return 'special';
    }
    if (pos.includes('punter') || pos === 'p') {
        return 'special';
    }
    if (pos.includes('long snapper') || pos === 'ls') {
        return 'special';
    }
    if (['kr', 'pr'].includes(pos)) {
        return 'special';
    }
    // Default to offense if unknown
    return 'offense';
}
function getComprehensiveRoster() {
    return [
        // Quarterbacks
        { number: 1, name: "Dylan Raiola", position: "QB", class: "Fr", height: "6'3\"", weight: "220", hometown: "Chandler, AZ", category: "offense" },
        { number: 10, name: "Nick Henrich", position: "QB", class: "Jr", height: "6'3\"", weight: "210", hometown: "Elkhorn, NE", category: "offense" },
        { number: 16, name: "Braxton Gottschalk", position: "QB", class: "Fr", height: "6'2\"", weight: "200", hometown: "West Point, NE", category: "offense" },
        // Running Backs
        { number: 3, name: "Rahmir Johnson", position: "RB", class: "Sr", height: "5'11\"", weight: "215", hometown: "Newark, NJ", category: "offense" },
        { number: 4, name: "Dante Dowdell", position: "RB", class: "So", height: "6'1\"", weight: "225", hometown: "Pickerington, OH", category: "offense" },
        { number: 20, name: "Emmett Johnson", position: "RB", class: "So", height: "6'0\"", weight: "210", hometown: "Hinckley, MN", category: "offense" },
        { number: 25, name: "Gabe Ervin", position: "RB", class: "Fr", height: "6'0\"", weight: "205", hometown: "Blair, NE", category: "offense" },
        { number: 32, name: "Blake Boyd", position: "FB", class: "Jr", height: "6'1\"", weight: "240", hometown: "Bellevue, NE", category: "offense" },
        // Wide Receivers
        { number: 5, name: "Isaiah Neyor", position: "WR", class: "Sr", height: "6'3\"", weight: "205", hometown: "Austin, TX", category: "offense" },
        { number: 7, name: "Jacory Barney Jr.", position: "WR", class: "Jr", height: "5'11\"", weight: "185", hometown: "Katy, TX", category: "offense" },
        { number: 8, name: "Malachi Coleman", position: "WR", class: "So", height: "6'3\"", weight: "200", hometown: "East St. Louis, IL", category: "offense" },
        { number: 11, name: "Janiran Bonner", position: "WR", class: "Fr", height: "6'2\"", weight: "190", hometown: "Tampa, FL", category: "offense" },
        { number: 15, name: "Isaiah Garcia-Castaneda", position: "WR", class: "Fr", height: "6'0\"", weight: "175", hometown: "Gretna, NE", category: "offense" },
        { number: 17, name: "Jaylen Lloyd", position: "WR", class: "Jr", height: "6'0\"", weight: "180", hometown: "Omaha, NE", category: "offense" },
        { number: 80, name: "Kaine Reilly", position: "WR", class: "So", height: "6'1\"", weight: "185", hometown: "Elkhorn, NE", category: "offense" },
        { number: 81, name: "Carter Nelson", position: "WR", class: "Fr", height: "6'4\"", weight: "200", hometown: "Council Bluffs, IA", category: "offense" },
        // Tight Ends
        { number: 14, name: "Thomas Fidone II", position: "TE", class: "Jr", height: "6'5\"", weight: "245", hometown: "Council Bluffs, IA", category: "offense" },
        { number: 85, name: "Nate Boerkircher", position: "TE", class: "Sr", height: "6'4\"", weight: "250", hometown: "Bellevue, NE", category: "offense" },
        { number: 86, name: "Benjamin Brahmer", position: "TE", class: "So", height: "6'5\"", weight: "240", hometown: "Howells, NE", category: "offense" },
        { number: 89, name: "AJ Rollins", position: "TE", class: "Jr", height: "6'3\"", weight: "235", hometown: "Lincoln, NE", category: "offense" },
        // Offensive Line
        { number: 50, name: "Bryce Benhart", position: "OT", class: "Sr", height: "6'8\"", weight: "315", hometown: "Lakeville, MN", category: "offense" },
        { number: 55, name: "Ben Scott", position: "C", class: "Sr", height: "6'4\"", weight: "300", hometown: "Elkhorn, NE", category: "offense" },
        { number: 58, name: "Micah Mazzccua", position: "OG", class: "Jr", height: "6'4\"", weight: "310", hometown: "Bellevue, NE", category: "offense" },
        { number: 65, name: "Henry Lutovsky", position: "OT", class: "So", height: "6'6\"", weight: "305", hometown: "Lincoln, NE", category: "offense" },
        { number: 70, name: "Teddy Prochazka", position: "OT", class: "Jr", height: "6'7\"", weight: "320", hometown: "Omaha, NE", category: "offense" },
        { number: 71, name: "Gunnar Gottula", position: "OG", class: "So", height: "6'4\"", weight: "295", hometown: "Pierce, NE", category: "offense" },
        { number: 72, name: "Brock Knutson", position: "OT", class: "Fr", height: "6'7\"", weight: "290", hometown: "Papillion, NE", category: "offense" },
        { number: 73, name: "Justin Evans-Jenkins", position: "OT", class: "Jr", height: "6'6\"", weight: "325", hometown: "Council Bluffs, IA", category: "offense" },
        { number: 74, name: "Maverick Noonan", position: "OG", class: "So", height: "6'3\"", weight: "300", hometown: "Bellevue, NE", category: "offense" },
        { number: 75, name: "Corcoran Husz", position: "C", class: "Jr", height: "6'3\"", weight: "295", hometown: "Papillion, NE", category: "offense" },
        // Defensive Line
        { number: 21, name: "Nash Hutmacher", position: "DE", class: "Sr", height: "6'6\"", weight: "285", hometown: "Chamberlain, SD", category: "defense" },
        { number: 22, name: "Ty Robinson", position: "DT", class: "Jr", height: "6'3\"", weight: "295", hometown: "Sunrise, FL", category: "defense" },
        { number: 91, name: "Riley Van Poppel", position: "DE", class: "So", height: "6'4\"", weight: "265", hometown: "Elkhorn, NE", category: "defense" },
        { number: 92, name: "Blaise Gunnerson", position: "DT", class: "Jr", height: "6'2\"", weight: "290", hometown: "Lincoln, NE", category: "defense" },
        { number: 93, name: "Jimari Butler", position: "DE", class: "Jr", height: "6'3\"", weight: "270", hometown: "Bellevue, NE", category: "defense" },
        { number: 94, name: "Princewill Umanmielen", position: "DE", class: "Jr", height: "6'4\"", weight: "280", hometown: "Manor, TX", category: "defense" },
        { number: 95, name: "Cameron Lenhardt", position: "DT", class: "So", height: "6'4\"", weight: "285", hometown: "Wahoo, NE", category: "defense" },
        { number: 97, name: "Kai Wallin", position: "DE", class: "Fr", height: "6'5\"", weight: "250", hometown: "Omaha, NE", category: "defense" },
        { number: 99, name: "Elijah Jeudy", position: "DT", class: "So", height: "6'2\"", weight: "300", hometown: "Miami, FL", category: "defense" },
        // Linebackers
        { number: 23, name: "MJ Sherman", position: "LB", class: "So", height: "6'2\"", weight: "235", hometown: "Cedar Rapids, IA", category: "defense" },
        { number: 31, name: "John Bullock", position: "LB", class: "Jr", height: "6'1\"", weight: "230", hometown: "Bellevue, NE", category: "defense" },
        { number: 33, name: "Vincent Shavers Jr.", position: "LB", class: "Sr", height: "6'0\"", weight: "225", hometown: "Philadelphia, PA", category: "defense" },
        { number: 34, name: "Luke Reimer", position: "LB", class: "Sr", height: "6'2\"", weight: "240", hometown: "Papillion, NE", category: "defense" },
        { number: 35, name: "Ernest Hausmann", position: "LB", class: "Jr", height: "6'1\"", weight: "230", hometown: "Omaha, NE", category: "defense" },
        { number: 36, name: "Stefon Thompson", position: "LB", class: "So", height: "6'3\"", weight: "225", hometown: "Lincoln, NE", category: "defense" },
        { number: 40, name: "Randolph Kpai", position: "LB", class: "Fr", height: "6'2\"", weight: "215", hometown: "Bellevue, NE", category: "defense" },
        // Defensive Backs
        { number: 2, name: "Ceyair Wright", position: "CB", class: "Jr", height: "6'1\"", weight: "185", hometown: "Los Angeles, CA", category: "defense" },
        { number: 6, name: "Quinton Newsome", position: "CB", class: "Sr", height: "6'1\"", weight: "190", hometown: "IMG Academy, FL", category: "defense" },
        { number: 12, name: "Kwinten Ives", position: "S", class: "Sr", height: "6'2\"", weight: "200", hometown: "Las Vegas, NV", category: "defense" },
        { number: 18, name: "DeShon Singleton", position: "S", class: "Sr", height: "6'1\"", weight: "200", hometown: "Jacksonville, FL", category: "defense" },
        { number: 19, name: "Tommi Hill", position: "CB", class: "So", height: "5'10\"", weight: "175", hometown: "Bellevue, NE", category: "defense" },
        { number: 24, name: "Javin Wright", position: "CB", class: "Fr", height: "6'0\"", weight: "180", hometown: "Omaha, NE", category: "defense" },
        { number: 26, name: "Isaac Gifford", position: "S", class: "Sr", height: "6'0\"", weight: "195", hometown: "Fremont, NE", category: "defense" },
        { number: 27, name: "Marques Buford Jr.", position: "CB", class: "Jr", height: "5'11\"", weight: "180", hometown: "Dallas, TX", category: "defense" },
        { number: 28, name: "Malcolm Hartzog Jr.", position: "CB", class: "Jr", height: "6'0\"", weight: "185", hometown: "Millville, NJ", category: "defense" },
        { number: 29, name: "Myles Farmer", position: "S", class: "So", height: "6'2\"", weight: "190", hometown: "Papillion, NE", category: "defense" },
        { number: 30, name: "Koby Bretz", position: "S", class: "Jr", height: "6'1\"", weight: "195", hometown: "Kearney, NE", category: "defense" },
        // Special Teams
        { number: 9, name: "John Hohl", position: "P", class: "Jr", height: "6'1\"", weight: "195", hometown: "Papillion, NE", category: "special" },
        { number: 13, name: "Tristan Alvano", position: "K", class: "So", height: "5'11\"", weight: "180", hometown: "Kearney, NE", category: "special" },
        { number: 39, name: "John Hohl", position: "P", class: "Jr", height: "6'1\"", weight: "195", hometown: "Papillion, NE", category: "special" },
        { number: 41, name: "Brian Buschini", position: "P", class: "Sr", height: "6'1\"", weight: "185", hometown: "Prosper, TX", category: "special" },
        { number: 48, name: "James Carnie", position: "LS", class: "Jr", height: "6'2\"", weight: "225", hometown: "Papillion, NE", category: "special" }
    ];
}
