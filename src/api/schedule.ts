// Schedule API for Cloudflare Worker
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

export async function handleScheduleRequest(request: Request, env: any): Promise<Response> {
  const CACHE_KEY = 'nebraska_schedule_2025_espn_v1';
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
    let cachedData: CachedData | null = null;
    
    if (env.SCHEDULE_CACHE) {
      try {
        const cached = await env.SCHEDULE_CACHE.get(CACHE_KEY);
        if (cached) {
          cachedData = JSON.parse(cached);
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
      
      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=3600'
        }
      });
    }

    // Fetch fresh data from ESPN
    let scheduleData: ScheduleGame[] = [];
    let dataSource = 'espn-api';
    
    try {
      const espnResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/158/schedule');
      
      if (espnResponse.ok) {
        const espnData = await espnResponse.json();
        scheduleData = parseESPNSchedule(espnData);
        console.log(`Fetched ${scheduleData.length} games from ESPN API`);
      } else {
        throw new Error(`ESPN API returned ${espnResponse.status}`);
      }
    } catch (error) {
      console.error('Error fetching from ESPN:', error);
      scheduleData = getHardcodedSchedule();
      dataSource = 'hardcoded-fallback';
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

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600'
      }
    });
    
  } catch (error) {
    console.error('Schedule handler error:', error);
    
    const response: ScheduleResponse = {
      success: true,
      data: getHardcodedSchedule(),
      cached: false,
      source: 'emergency-fallback',
      lastUpdated: new Date().toISOString(),
      error: 'Using emergency fallback data'
    };
    
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
}

function parseESPNSchedule(espnData: any): ScheduleGame[] {
  const games: ScheduleGame[] = [];
  
  if (!espnData?.events || !Array.isArray(espnData.events)) {
    return games;
  }
  
  for (const event of espnData.events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;
    
    const competitors = competition.competitors || [];
    const nebraskaCompetitor = competitors.find((c: any) => c.team.id === '158');
    const opponentCompetitor = competitors.find((c: any) => c.team.id !== '158');
    
    if (!nebraskaCompetitor || !opponentCompetitor) continue;
    
    const isHome = nebraskaCompetitor.homeAway === 'home';
    const isNeutral = competition.neutralSite === true;
    
    const gameDate = new Date(event.date);
    const dateString = gameDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'America/Chicago'
    });
    
    let timeString = 'TBD';
    if (competition.timeValid) {
      const ctTime = gameDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        timeZone: 'America/Chicago'
      });
      timeString = ctTime.replace(/\s+/g, ' ');
    }
    
    const tvNetwork = competition.broadcasts?.[0]?.media?.shortName || 'TBD';
    
    const venue = competition.venue;
    const location = venue ? `${venue.fullName}${venue.address?.city ? ', ' + venue.address.city : ''}${venue.address?.state ? ', ' + venue.address.state : ''}` : 'TBA';
    
    games.push({
      date: dateString,
      opponent: opponentCompetitor.team.displayName,
      time: timeString,
      location: location,
      tvNetwork: tvNetwork,
      isHome: isHome,
      isNeutral: isNeutral
    });
  }
  
  return games;
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
      time: "6:30 PM",
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