// Cloudflare Pages Function to provide schedule data from FBSchedules.com with daily caching
export async function onRequest(context) {
  const { request, env } = context;
  
  const CACHE_KEY = 'nebraska_schedule_2025_fbschedules_v2';
  const CACHE_TTL = 60 * 60 * 24; // 24 hours in seconds (daily refresh)
  
  // CORS headers
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

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
        source: cachedData.source || 'cache',
        nextRefresh: new Date(cachedData.timestamp + (CACHE_TTL * 1000)).toISOString()
      }), {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    console.log('Cache expired or not found, fetching fresh data...');
    
    // Try to fetch from FBSchedules.com
    let scheduleData = null;
    let dataSource = 'fbschedules-scrape';
    
    try {
      scheduleData = await fetchFBSchedulesData();
      console.log(`Successfully scraped ${scheduleData.length} games from FBSchedules.com`);
    } catch (scrapeError) {
      console.error('Failed to scrape FBSchedules.com:', scrapeError);
      
      // Fall back to hardcoded data
      scheduleData = getHardcodedFBSchedulesData();
      dataSource = 'hardcoded-fallback';
      console.log('Using hardcoded fallback data');
    }
    
    // Cache the fresh data
    if (env.SCHEDULE_CACHE && scheduleData && scheduleData.length > 0) {
      try {
        await env.SCHEDULE_CACHE.put(CACHE_KEY, JSON.stringify({
          data: scheduleData,
          timestamp: Date.now(),
          source: dataSource
        }), { expirationTtl: CACHE_TTL });
        console.log(`Cached fresh schedule data from ${dataSource} for 24 hours`);
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
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600'
      }
    });
    
  } catch (error) {
    console.error('Error in schedule handler:', error);
    
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
          ...corsHeaders,
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
    
    // Last resort: return hardcoded data
    return new Response(JSON.stringify({
      success: true,
      data: getHardcodedFBSchedulesData(),
      cached: false,
      source: 'emergency-fallback',
      error: 'Using emergency fallback data'
    }), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
}

async function fetchFBSchedulesData() {
  const url = 'https://fbschedules.com/nebraska-football-schedule/';
  
  // User agent to identify our bot
  const headers = {
    'User-Agent': 'RhuleAid.com Bot (contact@rhuleaid.com) - Caching Nebraska schedule data'
  };
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`FBSchedules returned ${response.status}`);
  }
  
  const html = await response.text();
  
  // Parse the schedule data from the HTML
  const games = parseScheduleFromHTML(html);
  
  if (!games || games.length === 0) {
    throw new Error('No games found in HTML');
  }
  
  return games;
}

function parseScheduleFromHTML(html) {
  const games = [];
  
  // Regular expressions to extract schedule data
  // FBSchedules uses a table with class "college-football-schedule"
  const tableRegex = /<table[^>]*class="[^"]*college-football-schedule[^"]*"[^>]*>([\s\S]*?)<\/table>/i;
  const tableMatch = html.match(tableRegex);
  
  if (!tableMatch) {
    console.error('Could not find schedule table in HTML');
    return games;
  }
  
  const tableHTML = tableMatch[1];
  
  // Extract each row (game)
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = tableHTML.match(rowRegex) || [];
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th') || row.includes('thead')) continue;
    
    // Extract data from cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      // Remove HTML tags and clean up the text
      const cellText = cellMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      cells.push(cellText);
    }
    
    if (cells.length >= 4) {
      // Typical format: Date, Time, Opponent, Location/Result
      const dateStr = cells[0];
      const timeStr = cells[1];
      let opponent = cells[2];
      const locationOrResult = cells[3];
      const tvNetwork = cells[4] || 'TBD';
      
      // Skip if no valid date
      if (!dateStr || dateStr === 'Date') continue;
      
      // Determine if home/away/neutral
      let isHome = false;
      let isNeutral = false;
      let location = 'Memorial Stadium, Lincoln, NE'; // default
      
      if (opponent.startsWith('at ')) {
        opponent = opponent.substring(3);
        isHome = false;
        location = locationOrResult || 'TBD';
      } else if (opponent.startsWith('vs ')) {
        // "vs" can mean neutral site
        opponent = opponent.substring(3);
        if (locationOrResult && !locationOrResult.includes('Lincoln')) {
          isNeutral = true;
          location = locationOrResult;
        } else {
          isHome = true;
        }
      } else {
        // No prefix usually means home game
        isHome = true;
      }
      
      // Clean up opponent name (remove rankings, etc.)
      opponent = opponent.replace(/^[\d#]+\s+/, '').trim();
      
      // Add the full team name if we can match it
      const teamMapping = {
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
      
      // Try to match and expand team name
      for (const [key, value] of Object.entries(teamMapping)) {
        if (opponent.includes(key)) {
          opponent = value;
          break;
        }
      }
      
      // Map stadium names
      const stadiumMapping = {
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
      
      // If away game, try to get the proper stadium
      if (!isHome && !isNeutral) {
        for (const [team, stadium] of Object.entries(stadiumMapping)) {
          if (opponent.includes(team)) {
            location = stadium;
            break;
          }
        }
      }
      
      games.push({
        date: dateStr,
        opponent: opponent,
        time: timeStr === 'TBA' ? 'TBD' : timeStr,
        location: location,
        tvNetwork: tvNetwork === 'TBA' ? 'TBD' : tvNetwork,
        isHome: isHome,
        isNeutral: isNeutral
      });
    }
  }
  
  return games;
}

function getHardcodedFBSchedulesData() {
  // Hardcoded fallback data - same as current implementation
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