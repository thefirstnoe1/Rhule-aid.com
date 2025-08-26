// Betting Lines API for Cloudflare Worker
interface BettingLine {
  game_id?: string;
  away_team: string;
  home_team: string;
  away_spread?: string;
  home_spread?: string;
  nebraska_spread?: string;
  total?: string;
  away_moneyline?: string;
  home_moneyline?: string;
  sportsbook?: string;
  last_updated?: string;
}

interface BettingResponse {
  success: boolean;
  line?: BettingLine;
  cached: boolean;
  lastUpdated: string;
  source: string;
  error?: string;
}

interface CachedBettingData {
  line: BettingLine;
  timestamp: number;
  source: string;
}

export async function handleBettingRequest(request: Request, env: any): Promise<Response> {
  const CACHE_TTL = 60 * 30; // 30 minutes
  
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
    const url = new URL(request.url);
    const team1 = url.searchParams.get('team1') || '';
    const team2 = url.searchParams.get('team2') || '';
    
    if (!team1 || !team2) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Both team1 and team2 parameters are required'
      }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const cacheKey = `betting_${team1}_vs_${team2}`.replace(/[^a-zA-Z0-9_]/g, '_');
    
    // Check for cached data
    let cachedData: CachedBettingData | null = null;
    
    if (env.BETTING_CACHE) {
      try {
        const cached = await env.BETTING_CACHE.get(cacheKey);
        if (cached) {
          cachedData = JSON.parse(cached);
        }
      } catch (error) {
        console.error('Betting cache read error:', error);
      }
    }
    
    // Return cached data if still valid
    if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp) < (CACHE_TTL * 1000)) {
      const response: BettingResponse = {
        success: true,
        line: cachedData.line,
        cached: true,
        lastUpdated: new Date(cachedData.timestamp).toISOString(),
        source: cachedData.source
      };
      
      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'public, max-age=1800'
        }
      });
    }

    // Fetch real betting data from our CFB API
    const bettingLine = await fetchRealBettingLine(request, team1, team2);
    
    // If no real betting data available, return an error
    if (!bettingLine) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No betting lines available for this matchup'
      }), {
        status: 404,
        headers: corsHeaders
      });
    }
    
    // Cache the data
    if (env.BETTING_CACHE && bettingLine) {
      try {
        const cacheData: CachedBettingData = {
          line: bettingLine,
          timestamp: Date.now(),
          source: bettingLine.sportsbook || 'ESPN BET'
        };
        
        await env.BETTING_CACHE.put(cacheKey, JSON.stringify(cacheData), { 
          expirationTtl: CACHE_TTL 
        });
      } catch (error) {
        console.error('Betting cache write error:', error);
      }
    }

    const response: BettingResponse = {
      success: true,
      line: bettingLine,
      cached: false,
      lastUpdated: new Date().toISOString(),
      source: bettingLine?.sportsbook || 'ESPN BET'
    };

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'public, max-age=1800'
      }
    });
    
  } catch (error) {
    console.error('Betting handler error:', error);
    
    const response: BettingResponse = {
      success: false,
      cached: false,
      lastUpdated: new Date().toISOString(),
      source: 'error',
      error: 'Failed to fetch betting lines'
    };
    
    return new Response(JSON.stringify(response), {
      status: 500,
      headers: corsHeaders
    });
  }
}

async function fetchRealBettingLine(request: Request, team1: string, team2: string): Promise<BettingLine | null> {
  try {
    // Get the base URL from the request
    const baseUrl = new URL(request.url).origin;
    
    // Fetch CFB games data - try current week first, then week 1
    let cfbResponse = await fetch(`${baseUrl}/api/cfb`);
    if (!cfbResponse.ok) {
      throw new Error('Failed to fetch CFB data');
    }
    
    let cfbData: any = await cfbResponse.json();
    if (!cfbData.success || !cfbData.data) {
      throw new Error('Invalid CFB data response');
    }
    
    // If no games with odds in current week, try week 1
    const gamesWithOdds = cfbData.data.filter((g: any) => g.odds);
    if (gamesWithOdds.length === 0) {
      cfbResponse = await fetch(`${baseUrl}/api/cfb?week=1`);
      if (cfbResponse.ok) {
        const week1Data: any = await cfbResponse.json();
        if (week1Data.success && week1Data.data) {
          cfbData = week1Data;
        }
      }
    }
    
    // For debugging - let's return what data we're actually seeing
    console.log('Betting API debug:', {
      totalGames: cfbData.data.length,
      gamesWithOdds: cfbData.data.filter((g: any) => g.odds).length,
      firstGameWithOdds: cfbData.data.find((g: any) => g.odds) ? {
        home: cfbData.data.find((g: any) => g.odds).homeTeam.displayName,
        away: cfbData.data.find((g: any) => g.odds).awayTeam.displayName,
        homeAbbr: cfbData.data.find((g: any) => g.odds).homeTeam.abbreviation,
        awayAbbr: cfbData.data.find((g: any) => g.odds).awayTeam.abbreviation
      } : null
    });
    
    // Find the game between these two teams
    const game = cfbData.data.find((g: any) => {
      if (!g.odds) return false; // Skip games without odds
      
      // For debugging, let's test with a very simple exact match first
      if (team1.toLowerCase() === 'usf' && team2.toLowerCase() === 'bois') {
        if (g.homeTeam.abbreviation === 'USF' && g.awayTeam.abbreviation === 'BOIS') {
          console.log('Found exact match: USF vs BOIS');
          return true;
        }
        if (g.homeTeam.abbreviation === 'BOIS' && g.awayTeam.abbreviation === 'USF') {
          console.log('Found exact match: BOIS vs USF');
          return true;
        }
      }
      
      const homeTeam = g.homeTeam.displayName.toLowerCase();
      const awayTeam = g.awayTeam.displayName.toLowerCase();
      const homeAbbr = g.homeTeam.abbreviation.toLowerCase();
      const awayAbbr = g.awayTeam.abbreviation.toLowerCase();
      
      const team1Lower = team1.toLowerCase();
      const team2Lower = team2.toLowerCase();
      
      // Check if both teams are in this game (either as home or away)
      const team1InGame = homeTeam.includes(team1Lower) || awayTeam.includes(team1Lower) || 
                         homeAbbr === team1Lower || awayAbbr === team1Lower;
      
      const team2InGame = homeTeam.includes(team2Lower) || awayTeam.includes(team2Lower) || 
                         homeAbbr === team2Lower || awayAbbr === team2Lower;
      
      return team1InGame && team2InGame;
    });
    
    if (!game || !game.odds) {
      // Return null if no game found or no odds available
      console.log('Debug info:', {
        searchTerms: { team1, team2 },
        totalGames: cfbData.data.length,
        gamesWithOdds: cfbData.data.filter((g: any) => g.odds).length,
        availableMatchups: cfbData.data.filter((g: any) => g.odds).slice(0, 3).map((g: any) => ({
          home: g.homeTeam.displayName,
          away: g.awayTeam.displayName,
          homeAbbr: g.homeTeam.abbreviation,
          awayAbbr: g.awayTeam.abbreviation
        }))
      });
      return null;
    }
    
    // Determine Nebraska's role and calculate Nebraska-specific spread
    const nebraskaTeam1 = team1.toLowerCase().includes('nebraska') || team1.toLowerCase().includes('neb');
    const nebraskaTeam2 = team2.toLowerCase().includes('nebraska') || team2.toLowerCase().includes('neb');
    
    let nebraskaSpread = '';
    if (nebraskaTeam1 || nebraskaTeam2) {
      const nebraskaIsHome = (nebraskaTeam1 && game.homeTeam.displayName.toLowerCase().includes('nebraska')) ||
                            (nebraskaTeam2 && game.homeTeam.displayName.toLowerCase().includes('nebraska'));
      
      if (nebraskaIsHome) {
        nebraskaSpread = game.odds.spread.home;
      } else {
        nebraskaSpread = game.odds.spread.away;
      }
    }
    
    return {
      game_id: game.id,
      away_team: game.awayTeam.displayName,
      home_team: game.homeTeam.displayName,
      away_spread: game.odds.spread.away,
      home_spread: game.odds.spread.home,
      nebraska_spread: nebraskaSpread,
      total: game.odds.total,
      away_moneyline: game.odds.moneyline.away,
      home_moneyline: game.odds.moneyline.home,
      sportsbook: game.odds.provider,
      last_updated: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error fetching real betting line:', error);
    return null;
  }
}