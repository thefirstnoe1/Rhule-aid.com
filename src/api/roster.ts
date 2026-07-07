// Roster API for Cloudflare Worker
interface Player {
  number: number;
  name: string;
  position: string;
  class: string;
  height: string;
  weight: string;
  hometown: string;
  category?: string;
}

export async function handleRosterRequest(request: Request, env: any): Promise<Response> {
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
    let rosterData: Player[] = [];
    
    try {
      rosterData = await scrapeNebraskaRoster();
    } catch (error) {
      console.warn('Failed to scrape roster:', error);
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

  } catch (error) {
    console.error('Roster fetch error:', error);
    
    // Parse query parameters for error response too
    const url = new URL(request.url);
    const sortBy = url.searchParams.get('sort') || 'number';
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch roster',
      data: [],
      sortBy: sortBy
    }), { 
      status: 200,
      headers: corsHeaders 
    });
  }
}

function sortRosterData(players: Player[], sortBy: string): Player[] {
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
        const categoryOrder: Record<string, number> = { 'offense': 1, 'defense': 2, 'special': 3 };
        const aCat = categoryOrder[a.category || 'offense'] || 4;
        const bCat = categoryOrder[b.category || 'offense'] || 4;
        
        if (aCat !== bCat) return aCat - bCat;
        return a.number - b.number;
      });
  }
}

async function scrapeNebraskaRoster(): Promise<Player[]> {
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
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    const players: Player[] = [];
    
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
        
        if (!cellMatches || cellMatches.length < 6) continue;
        
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
    
    // Try list view if table view fails.
    if (players.length === 0) {
      const listItemRegex = /<li[^>]*class="[^"]*roster-list-item[^"]*"[^>]*>[\s\S]*?<\/li>/gi;
      let cardMatches = html.match(listItemRegex);
      
      if (cardMatches) {
        console.log(`Found ${cardMatches.length} roster list items`);
        
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
        
        // Extract position - may not be available in list view.
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
    }    if (players.length === 0) {
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
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
    }
    
    console.log(`Extracted ${players.length} players from roster`);
    
    // Sort players by jersey number to ensure consistent ordering
    players.sort((a, b) => a.number - b.number);
    
    return players; // Return all players found
  } catch (error) {
    console.error('Nebraska roster scrape error:', error);
    return [];
  }
}

function categorizePosition(position: string): string {
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
