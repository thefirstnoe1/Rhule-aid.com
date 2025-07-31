// Cloudflare Pages Function to provide schedule data from FBSchedules.com with caching
export async function onRequest(context) {
  const { request, env } = context;
  
  const CACHE_KEY = 'nebraska_schedule_2025_fbschedules_dynamic';
  const CACHE_TTL = 60 * 60 * 24; // 24 hours for daily refresh
  
  try {
    // Try to get cached data first
    let cachedData = null;
    if (env.SCHEDULE_CACHE) {
      try {
        const cached = await env.SCHEDULE_CACHE.get(CACHE_KEY);
        if (cached) {
          cachedData = JSON.parse(cached);
          console.log('Found cached schedule data');
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
        source: cachedData.source || 'cache'
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

    console.log('Fetching fresh schedule data...');
    
    let scheduleData;
    let dataSource;
    
    try {
      // Try to scrape from FBSchedules.com
      scheduleData = await fetchScheduleFromFBSchedules();
      dataSource = 'fbschedules-live';
      console.log(`Successfully fetched ${scheduleData.length} games from FBSchedules.com`);
    } catch (scrapeError) {
      console.error('Failed to scrape FBSchedules.com:', scrapeError);
      // Fall back to hardcoded data
      scheduleData = getFBSchedulesData();
      dataSource = 'fbschedules-hardcoded';
      console.log('Using hardcoded fallback schedule data');
    }
    
    console.log('Schedule data being returned:', JSON.stringify(scheduleData.slice(0, 3), null, 2));

    // Cache the fresh data
    if (env.SCHEDULE_CACHE && scheduleData.length > 0) {
      try {
        await env.SCHEDULE_CACHE.put(CACHE_KEY, JSON.stringify({
          data: scheduleData,
          timestamp: Date.now(),
          source: dataSource
        }), { expirationTtl: CACHE_TTL });
        console.log(`Cached fresh schedule data from ${dataSource}`);
      } catch (error) {
        console.log('Cache write error:', error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: scheduleData,
      cached: false,
      lastUpdated: new Date().toISOString(),
      source: dataSource,
      count: scheduleData.length,
      nextRefresh: new Date(Date.now() + (CACHE_TTL * 1000)).toISOString()
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
    console.error('Error fetching schedule data:', error);
    
    // Try to return stale cached data if available
    if (cachedData && cachedData.data) {
      console.log('Returning stale cached data due to error');
      return new Response(JSON.stringify({
        success: true,
        data: cachedData.data,
        cached: true,
        stale: true,
        lastUpdated: new Date(cachedData.timestamp).toISOString(),
        source: cachedData.source || 'stale-cache'
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
      error: 'Failed to fetch schedule data',
      data: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function fetchScheduleFromFBSchedules() {
  const url = 'https://fbschedules.com/nebraska-football-schedule/';
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RhuleAid.com/1.0 (Nebraska Football Schedule Bot)',
      'Accept': 'text/html,application/xhtml+xml',
    }
  });
  
  if (!response.ok) {
    throw new Error(`FBSchedules returned status ${response.status}`);
  }
  
  const html = await response.text();
  return parseScheduleHTML(html);
}

function parseScheduleHTML(html) {
  const games = [];
  
  // Look for schedule table
  const tableRegex = /<table[^>]*class="[^"]*college-football-schedule[^"]*"[^>]*>([\s\S]*?)<\/table>/i;
  const tableMatch = html.match(tableRegex);
  
  if (!tableMatch) {
    throw new Error('Could not find schedule table in HTML');
  }
  
  const tableHTML = tableMatch[1];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = tableHTML.match(rowRegex) || [];
  
  for (const row of rows) {
    if (row.includes('<th') || row.includes('thead')) continue;
    
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      const cellText = cellMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      cells.push(cellText);
    }
    
    if (cells.length >= 3) {
      const game = parseGameFromCells(cells);
      if (game) games.push(game);
    }
  }
  
  return games;
}

function parseGameFromCells(cells) {
  const dateStr = cells[0];
  if (!dateStr || dateStr.toLowerCase() === 'date') return null;
  
  const timeStr = cells[1] || 'TBD';
  let opponent = cells[2];
  const tvOrLocation = cells[3] || '';
  
  let isHome = true;
  let isNeutral = false;
  let location = 'Memorial Stadium, Lincoln, NE';
  
  // Parse opponent prefixes
  if (opponent.startsWith('at ') || opponent.startsWith('@ ')) {
    opponent = opponent.replace(/^(at |@ )/, '');
    isHome = false;
  } else if (opponent.startsWith('vs ')) {
    opponent = opponent.replace(/^vs\.? /, '');
    // Check for neutral site
    if (tvOrLocation && !tvOrLocation.match(/^(ESPN|FOX|CBS|NBC|BTN|FS1)/i)) {
      isNeutral = true;
      location = tvOrLocation;
      isHome = false;
    }
  }
  
  // Clean opponent name
  opponent = opponent.replace(/^#?\d+\s+/, '').trim();
  
  // Map team names
  const teamMap = {
    'Cincinnati': 'Cincinnati Bearcats',
    'Akron': 'Akron Zips',
    'HCU': 'HCU Huskies',
    'Houston Christian': 'HCU Huskies',
    'Michigan': 'Michigan Wolverines',
    'Michigan State': 'Michigan State Spartans',
    'Maryland': 'Maryland Terrapins',
    'Minnesota': 'Minnesota Golden Gophers',
    'Northwestern': 'Northwestern Wildcats',
    'USC': 'USC Trojans',
    'UCLA': 'UCLA Bruins',
    'Penn State': 'Penn State Nittany Lions',
    'Iowa': 'Iowa Hawkeyes'
  };
  
  for (const [key, value] of Object.entries(teamMap)) {
    if (opponent.includes(key)) {
      opponent = value;
      break;
    }
  }
  
  // Map stadiums for away games
  if (!isHome && !isNeutral) {
    const stadiumMap = {
      'Michigan': 'Michigan Stadium, Ann Arbor, MI',
      'Michigan State': 'Spartan Stadium, East Lansing, MI',
      'Maryland': 'SECU Stadium, College Park, MD',
      'Minnesota': 'Huntington Bank Stadium, Minneapolis, MN',
      'Northwestern': 'Ryan Field, Evanston, IL',
      'USC': 'Los Angeles Memorial Coliseum, Los Angeles, CA',
      'UCLA': 'Rose Bowl Stadium, Pasadena, CA',
      'Penn State': 'Beaver Stadium, University Park, PA',
      'Iowa': 'Kinnick Stadium, Iowa City, IA'
    };
    
    for (const [team, stadium] of Object.entries(stadiumMap)) {
      if (opponent.includes(team)) {
        location = stadium;
        break;
      }
    }
  }
  
  // Extract TV network
  let tvNetwork = 'TBD';
  const tvMatch = tvOrLocation.match(/(ESPN|FOX|CBS|NBC|BTN|FS1|ABC)/i);
  if (tvMatch) {
    tvNetwork = tvMatch[1].toUpperCase();
  }
  
  // Special case for Cincinnati neutral site game
  if (opponent.includes('Cincinnati') && dateStr.includes('August')) {
    isNeutral = true;
    location = 'Arrowhead Stadium, Kansas City, MO';
    isHome = false;
  }
  
  return {
    date: dateStr,
    opponent: opponent,
    time: timeStr === 'TBA' ? 'TBD' : timeStr,
    location: location,
    tvNetwork: tvNetwork,
    isHome: isHome,
    isNeutral: isNeutral
  };
}

function getFBSchedulesData() {
  // Return the specific schedule data from FBSchedules.com with full stadium names
  return [
    {
      date: "Thursday, August 28, 2025",
      opponent: "Cincinnati Bearcats",
      time: "9:00 PM",
      location: "Arrowhead Stadium, Kansas City, MO",
      tvNetwork: "ESPN",
      isHome: false,
      isNeutral: true
    },
    {
      date: "Saturday, September 6, 2025", 
      opponent: "Akron Zips",
      time: "7:30 PM",
      location: "Memorial Stadium, Lincoln, NE",
      tvNetwork: "BTN",
      isHome: true
    },
    {
      date: "Saturday, September 13, 2025",
      opponent: "HCU Huskies", 
      time: "12:00 PM",
      location: "Memorial Stadium, Lincoln, NE",
      tvNetwork: "FS1",
      isHome: true
    },
    {
      date: "Saturday, September 20, 2025",
      opponent: "Michigan Wolverines",
      time: "3:30 PM", 
      location: "Memorial Stadium, Lincoln, NE",
      tvNetwork: "CBS",
      isHome: true
    },
    {
      date: "Saturday, October 4, 2025",
      opponent: "Michigan State Spartans",
      time: "TBD",
      location: "Memorial Stadium, Lincoln, NE", 
      tvNetwork: "TBD",
      isHome: true
    },
    {
      date: "Saturday, October 11, 2025",
      opponent: "Maryland Terrapins",
      time: "TBD",
      location: "SECU Stadium, College Park, MD",
      tvNetwork: "TBD", 
      isHome: false
    },
    {
      date: "Friday, October 17, 2025",
      opponent: "Minnesota Golden Gophers",
      time: "8:00 PM",
      location: "Huntington Bank Stadium, Minneapolis, MN",
      tvNetwork: "FOX",
      isHome: false
    },
    {
      date: "Saturday, October 25, 2025",
      opponent: "Northwestern Wildcats",
      time: "TBD", 
      location: "Memorial Stadium, Lincoln, NE",
      tvNetwork: "TBD",
      isHome: true
    },
    {
      date: "Saturday, November 1, 2025",
      opponent: "USC Trojans",
      time: "TBD",
      location: "Memorial Stadium, Lincoln, NE",
      tvNetwork: "TBD",
      isHome: true
    },
    {
      date: "Saturday, November 8, 2025", 
      opponent: "UCLA Bruins",
      time: "TBD",
      location: "Rose Bowl Stadium, Pasadena, CA",
      tvNetwork: "TBD",
      isHome: false
    },
    {
      date: "Saturday, November 22, 2025",
      opponent: "Penn State Nittany Lions", 
      time: "TBD",
      location: "Beaver Stadium, University Park, PA",
      tvNetwork: "TBD",
      isHome: false
    },
    {
      date: "Friday, November 28, 2025",
      opponent: "Iowa Hawkeyes",
      time: "12:00 PM",
      location: "Memorial Stadium, Lincoln, NE",
      tvNetwork: "CBS",
      isHome: true
    }
  ];
}
