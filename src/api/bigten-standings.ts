// Big Ten Standings API for Cloudflare Worker
interface TeamStandingData {
  conf_record: string;
  conf_pct: string;
  conf_home_record: string;
  conf_away_record: string;
  conf_streak: string;
  ovr_record: string;
  ovr_pct: string;
  home_record: string;
  away_record: string;
  neutral_record: string;
  last10_record: string;
  streak: string;
}

interface TeamStanding {
  alias: string;
  conference_division?: string;
  data: TeamStandingData[];
  default_sorting_column: string;
  default_sorting_order: string;
  entity_id: string;
  market: string;
  team_rank: string;
}

interface CleanTeamStanding {
  alias: string;
  data: TeamStandingData[];
  default_sorting_column: string;
  default_sorting_order: string;
  entity_id: string;
  market: string;
  team_rank: string;
}

interface StandingsMetric {
  alias: string;
  category: string;
  conference_alias: string;
  date_updated: string;
  description: string;
  is_default_sorting: boolean;
  metric: string;
  metric_order: string;
  section: string;
  section_order: string;
  sorting: string;
  view: string;
}

interface BigTenStandingsApiResponse {
  available_seasons: Array<{ season_year: number }>;
  data: TeamStanding[];
  metrics: StandingsMetric[];
}

interface BigTenStandingsResponse {
  success: boolean;
  data: CleanTeamStanding[];
  cached: boolean;
  lastUpdated: string;
  source: string;
  count?: number;
  nextRefresh?: string;
  stale?: boolean;
  error?: string;
  season?: number;
}

interface CachedStandingsData {
  data: CleanTeamStanding[];
  timestamp: number;
  source: string;
  season: number;
}

export async function handleBigTenStandingsRequest(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url);
  const season = url.searchParams.get('season') || getCurrentFootballSeason().toString();
  
  const CACHE_KEY = `bigten_standings_${season}_v1`;
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
    let cachedData: CachedStandingsData | null = null;
    
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
      const response: BigTenStandingsResponse = {
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

    // Fetch fresh data from Big Ten API
    const apiUrl = `https://engage-api.boostsport.ai/api/sport/fb/standings/table?seasons=${season}&conference=Big%20Ten`;
    
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!apiResponse.ok) {
      throw new Error(`API request failed: ${apiResponse.status}`);
    }

    const apiData: BigTenStandingsApiResponse = await apiResponse.json();
    
    if (!apiData.data || !Array.isArray(apiData.data)) {
      throw new Error('Invalid API response format');
    }

    // Clean up the data - remove outdated division info and sort by rank
    const cleanedData = apiData.data
      .map(team => {
        const { conference_division, ...cleanTeam } = team;
        return cleanTeam;
      })
      .sort((a, b) => parseInt(a.team_rank) - parseInt(b.team_rank));

    // Cache the fresh data
    if (env.SCHEDULE_CACHE && cleanedData.length > 0) {
      try {
        const cacheData: CachedStandingsData = {
          data: cleanedData,
          timestamp: Date.now(),
          source: 'bigten-api',
          season: parseInt(season)
        };
        
        await env.SCHEDULE_CACHE.put(CACHE_KEY, JSON.stringify(cacheData), { 
          expirationTtl: CACHE_TTL 
        });
      } catch (error) {
        console.error('Cache write error:', error);
      }
    }

    const response: BigTenStandingsResponse = {
      success: true,
      data: cleanedData,
      cached: false,
      lastUpdated: new Date().toISOString(),
      source: 'bigten-api',
      count: cleanedData.length,
      nextRefresh: new Date(Date.now() + (CACHE_TTL * 1000)).toISOString(),
      season: parseInt(season)
    };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=3600'
      }
    });
    
  } catch (error) {
    console.error('Big Ten standings handler error:', error);
    
    const response: BigTenStandingsResponse = {
      success: false,
      data: [],
      cached: false,
      source: 'error',
      lastUpdated: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      season: parseInt(season)
    };
    
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Cache-Control': 'no-cache'
      }
    });
  }
}

function getCurrentFootballSeason(): number {
  const now = new Date();
  const currentYear = now.getFullYear();
  return now.getMonth() === 0 ? currentYear - 1 : currentYear;
}
