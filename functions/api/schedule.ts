// Cloudflare Pages Function to provide schedule data with daily refresh from FBSchedules.com
interface ScheduleGame {
  date: string;
  opponent: string;
  time: string;
  location: string;
  tvNetwork: string;
  isHome: boolean;
  isNeutral?: boolean;
  result?: string;
  score?: string;
}

interface ScheduleResponse {
  success: boolean;
  data: ScheduleGame[];
  cached: boolean;
  lastUpdated: string;
  source: string;
  count?: number;
  nextRefresh?: string;
  stale?: boolean;
  error?: string;
}

interface CachedData {
  data: ScheduleGame[];
  timestamp: number;
  source: string;
}

// Team name mapping for consistency
const TEAM_NAME_MAP: Record<string, string> = {
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

// Stadium mapping for away games
const STADIUM_MAP: Record<string, string> = {
  'Michigan': 'Michigan Stadium, Ann Arbor, MI',
  'Michigan State': 'Spartan Stadium, East Lansing, MI',
  'Maryland': 'SECU Stadium, College Park, MD',
  'Minnesota': 'Huntington Bank Stadium, Minneapolis, MN',
  'Northwestern': 'Ryan Field, Evanston, IL',
  'USC': 'Los Angeles Memorial Coliseum, Los Angeles, CA',
  'UCLA': 'Rose Bowl Stadium, Pasadena, CA',
  'Penn State': 'Beaver Stadium, University Park, PA',
  'Iowa': 'Kinnick Stadium, Iowa City, IA',
  'Cincinnati': 'Nippert Stadium, Cincinnati, OH'
};

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  
  const CACHE_KEY = 'nebraska_schedule_2025_dynamic';
  const CACHE_TTL = 60 * 60 * 24; // 24 hours for daily refresh
  
  // CORS headers
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check for cached data
    let cachedData: CachedData | null = null;
    
    if (env.SCHEDULE_CACHE) {
      try {
        const cached = await env.SCHEDULE_CACHE.get(CACHE_KEY);
        if (cached) {
          cachedData = JSON.parse(cached);
          console.log('Found cached schedule data');
        }
      } catch (error) {
        console.error('Cache read error:', error);
      }
    }
    
    // Return cached data if still valid
    if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp) < (CACHE_TTL * 1000)) {
      const response: ScheduleResponse = {
        success: true,
        data: cachedData.data,
        cached: true,
        lastUpdated: new Date(cachedData.timestamp).toISOString(),
        source: cachedData.source,
        count: cachedData.data.length,
        nextRefresh: new Date(cachedData.timestamp + (CACHE_TTL * 1000)).toISOString()
      };
      
      return Response.json(response, {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    console.log('Cache expired or not found, fetching fresh data...');
    
    // Fetch fresh data
    let scheduleData: ScheduleGame[] = [];
    let dataSource = 'fbschedules-api';
    
    try {
      // Try to fetch from FBSchedules
      scheduleData = await fetchScheduleFromFBSchedules();
      console.log(`Successfully fetched ${scheduleData.length} games from FBSchedules`);
    } catch (fetchError) {
      console.error('Failed to fetch from FBSchedules:', fetchError);
      
      // Use hardcoded fallback
      scheduleData = getHardcodedSchedule();
      dataSource = 'hardcoded-fallback';
      console.log('Using hardcoded fallback data');
    }
    
    // Cache the fresh data
    if (env.SCHEDULE_CACHE && scheduleData.length > 0) {
      try {
        const cacheData: CachedData = {
          data: scheduleData,
          timestamp: Date.now(),
          source: dataSource
        };
        
        await env.SCHEDULE_CACHE.put(CACHE_KEY, JSON.stringify(cacheData), { 
          expirationTtl: CACHE_TTL 
        });
        
        console.log(`Cached ${scheduleData.length} games for 24 hours`);
      } catch (error) {
        console.error('Cache write error:', error);
      }
    }

    const response: ScheduleResponse = {
      success: true,
      data: scheduleData,
      cached: false,
      lastUpdated: new Date().toISOString(),
      source: dataSource,
      count: scheduleData.length,
      nextRefresh: new Date(Date.now() + (CACHE_TTL * 1000)).toISOString()
    };

    return Response.json(response, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600'
      }
    });
    
  } catch (error) {
    console.error('Schedule handler error:', error);
    
    // Try stale cache
    if (cachedData?.data) {
      console.log('Returning stale cached data due to error');
      
      const response: ScheduleResponse = {
        success: true,
        data: cachedData.data,
        cached: true,
        stale: true,
        lastUpdated: new Date(cachedData.timestamp).toISOString(),
        source: 'stale-cache'
      };
      
      return Response.json(response, {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
    
    // Last resort: hardcoded data
    const response: ScheduleResponse = {
      success: true,
      data: getHardcodedSchedule(),
      cached: false,
      source: 'emergency-fallback',
      lastUpdated: new Date().toISOString(),
      error: 'Using emergency fallback data'
    };
    
    return Response.json(response, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
};

async function fetchScheduleFromFBSchedules(): Promise<ScheduleGame[]> {
  const url = 'https://fbschedules.com/nebraska-football-schedule/';
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RhuleAid.com/1.0 (Nebraska Football Schedule Bot)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html = await response.text();
  return parseScheduleHTML(html);
}

function parseScheduleHTML(html: string): ScheduleGame[] {
  const games: ScheduleGame[] = [];
  
  // Look for the schedule table
  // FBSchedules uses specific class names
  const tablePatterns = [
    /<table[^>]*class="[^"]*college-football-schedule[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
    /<table[^>]*class="[^"]*schedule[^"]*"[^>]*>([\s\S]*?)<\/table>/i,
    /<table[^>]*id="[^"]*schedule[^"]*"[^>]*>([\s\S]*?)<\/table>/i
  ];
  
  let tableHTML = '';
  for (const pattern of tablePatterns) {
    const match = html.match(pattern);
    if (match) {
      tableHTML = match[1];
      break;
    }
  }
  
  if (!tableHTML) {
    console.error('Could not find schedule table');
    throw new Error('Schedule table not found in HTML');
  }
  
  // Extract rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = tableHTML.match(rowRegex) || [];
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th') || row.includes('thead')) continue;
    
    // Extract cells
    const cells = extractCells(row);
    
    if (cells.length >= 3) {
      const game = parseGameRow(cells);
      if (game) {
        games.push(game);
      }
    }
  }
  
  // Validate we got a reasonable number of games
  if (games.length < 10 || games.length > 15) {
    console.warn(`Unexpected number of games: ${games.length}`);
  }
  
  return games;
}

function extractCells(row: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  
  while ((match = cellRegex.exec(row)) !== null) {
    // Clean the cell content
    const cellText = match[1]
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    cells.push(cellText);
  }
  
  return cells;
}

function parseGameRow(cells: string[]): ScheduleGame | null {
  // Expected format: Date, Time, Opponent, TV/Location
  if (cells.length < 3) return null;
  
  const dateStr = cells[0];
  const timeStr = cells[1] || 'TBD';
  let opponent = cells[2];
  const tvOrLocation = cells[3] || '';
  const extraInfo = cells[4] || '';
  
  // Skip invalid rows
  if (!dateStr || dateStr.toLowerCase() === 'date') return null;
  
  // Parse opponent and determine home/away/neutral
  let isHome = true;
  let isNeutral = false;
  let location = 'Memorial Stadium, Lincoln, NE';
  
  // Check for away game prefix
  if (opponent.startsWith('at ') || opponent.startsWith('@ ')) {
    opponent = opponent.replace(/^(at |@ )/, '');
    isHome = false;
  } else if (opponent.includes(' at ')) {
    // Sometimes format is "Team at Location"
    const parts = opponent.split(' at ');
    opponent = parts[0];
    location = parts[1];
    isHome = false;
  } else if (opponent.startsWith('vs ') || opponent.startsWith('vs. ')) {
    // "vs" might indicate neutral site
    opponent = opponent.replace(/^vs\.? /, '');
    
    // Check if there's a neutral site location
    if (tvOrLocation && !tvOrLocation.match(/^(ESPN|FOX|CBS|NBC|BTN|FS1)/i)) {
      isNeutral = true;
      location = tvOrLocation;
      isHome = false;
    }
  }
  
  // Remove rankings from opponent name
  opponent = opponent.replace(/^#?\d+\s+/, '').trim();
  
  // Normalize team names
  opponent = normalizeTeamName(opponent);
  
  // Get proper stadium for away games
  if (!isHome && !isNeutral) {
    location = getStadiumForTeam(opponent) || location;
  }
  
  // Extract TV network
  let tvNetwork = 'TBD';
  const tvMatch = (tvOrLocation + ' ' + extraInfo).match(/(ESPN|FOX|CBS|NBC|BTN|FS1|ABC|SEC Network|Big Ten Network)/i);
  if (tvMatch) {
    tvNetwork = tvMatch[1].toUpperCase();
    if (tvNetwork === 'BIG TEN NETWORK') tvNetwork = 'BTN';
  }
  
  // Handle special cases for neutral site games
  if (opponent.includes('Cincinnati') && dateStr.includes('August')) {
    isNeutral = true;
    location = 'Arrowhead Stadium, Kansas City, MO';
    isHome = false;
  }
  
  return {
    date: normalizeDate(dateStr),
    opponent,
    time: timeStr === 'TBA' ? 'TBD' : timeStr,
    location,
    tvNetwork,
    isHome,
    isNeutral
  };
}

function normalizeTeamName(opponent: string): string {
  // First, check exact matches
  for (const [key, value] of Object.entries(TEAM_NAME_MAP)) {
    if (opponent === key || opponent.toLowerCase() === key.toLowerCase()) {
      return value;
    }
  }
  
  // Then check if the opponent contains the key
  for (const [key, value] of Object.entries(TEAM_NAME_MAP)) {
    if (opponent.includes(key)) {
      return value;
    }
  }
  
  // Return original if no match
  return opponent;
}

function getStadiumForTeam(opponent: string): string | null {
  for (const [team, stadium] of Object.entries(STADIUM_MAP)) {
    if (opponent.includes(team)) {
      return stadium;
    }
  }
  return null;
}

function normalizeDate(dateStr: string): string {
  // FBSchedules might use different date formats
  // Try to standardize to "Day, Month DD, YYYY"
  
  // If already in correct format, return as-is
  if (dateStr.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \w+ \d{1,2}, \d{4}$/)) {
    return dateStr;
  }
  
  // Try to parse and reformat
  try {
    const date = new Date(dateStr + ', 2025'); // Assume 2025 if year not specified
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  } catch {
    return dateStr; // Return original if parsing fails
  }
}

function getHardcodedSchedule(): ScheduleGame[] {
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