import { Env } from '../types';

interface HuskerGame {
  id: string;
  datetime: string;
  title: string;
  opponent?: {
    name: string;
    customLogo?: {
      url: string;
    };
    officialLogo?: {
      url: string;
    };
  };
  location?: string;
  result?: string;
  status: string;
}

interface USNTGame {
  id: string;
  date: string;
  homeTeam: {
    name: string;
    logo?: string;
  };
  awayTeam: {
    name: string;
    logo?: string;
  };
  competition: {
    name: string;
  };
  venue?: {
    name: string;
    city: string;
    country: string;
  };
  status: string;
}

interface SoccerScheduleResponse {
  huskerWomens: HuskerGame[];
  usMens: USNTGame[];
  usWomens: USNTGame[];
  lastUpdated: string;
}

export async function handleSoccerRequest(request: Request, env: Env): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const cacheKey = 'soccer-schedule-v2';
    const cached = await env.SCHEDULE_CACHE?.get(cacheKey);
    
    if (cached) {
      const parsedCache = JSON.parse(cached);
      const cacheAge = Date.now() - new Date(parsedCache.lastUpdated).getTime();
      
      if (cacheAge < 30 * 60 * 1000) { // 30 minutes
        return new Response(cached, { headers });
      }
    }

    const [huskerResponse, usResponse] = await Promise.all([
      fetch('https://huskers.com/website-api/schedule-events?filter%5Bschedule_id%5D=1362&filter%5Bhide_from_specific_sport_schedule%5D=false&include=conference.image,opponent.customLogo,opponent.officialLogo,opponentLogo,postEventArticle.image,preEventArticle.image,presentedBy,promotionalItems.image,schedule.sport,scheduleEventLinks.icon,scheduleEventResult,scheduleEventTags.image,secondOpponent.customLogo,secondOpponent.officialLogo,secondOpponentLogo,tournament&per_page=1000&sort=datetime&', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Rhule-aid/1.0)',
          'Accept': 'application/json',
        }
      }),
      fetch('https://www.ussoccer.com/api/trpc/matches.getMatches?input=%7B%22json%22%3A%7B%22teamFilter%22%3Afalse%2C%22tournamentIds%22%3Anull%2C%22type%22%3A%22upcoming%22%2C%22contestantIds%22%3A%5B%22e70zl10x0ayu7y10ry0wi465a%22%2C%229vh2u1p4ppm597tjfahst2m3n%22%2C%222vnxw9nc0zq05fdawsdy9mc1n%22%2C%22be84r8u96b8jh66dwbv9b4qjk%22%2C%22ec3tww97m7qojokgz53yr44em%22%2C%22bo858sll0r8nayyt5smdu3pxs%22%2C%22bvwww6axicyq6121pawu2fq7k%22%2C%22x1zdh3b7nwu0ql0uc5tgic9e%22%2C%22optastub_deaf-wnt%22%5D%2C%22year%22%3A%22All%20Years%22%2C%22direction%22%3A%22forward%22%7D%2C%22meta%22%3A%7B%22values%22%3A%7B%22tournamentIds%22%3A%5B%22undefined%22%5D%7D%7D%7D', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Rhule-aid/1.0)',
          'Accept': 'application/json',
        }
      })
    ]);

    if (!huskerResponse.ok) {
      console.error('Husker API failed:', huskerResponse.status, huskerResponse.statusText);
      throw new Error(`Husker API request failed: ${huskerResponse.status}`);
    }
    if (!usResponse.ok) {
      console.error('US Soccer API failed:', usResponse.status, usResponse.statusText);
      throw new Error(`US Soccer API request failed: ${usResponse.status}`);
    }

    const [huskerData, usData] = await Promise.all([
      huskerResponse.json(),
      usResponse.json()
    ]) as [any, any];

    // Process Husker Women's Soccer data
    const huskerWomens: HuskerGame[] = (huskerData?.data || [])
      .filter((game: any) => game.datetime) // Filter first to ensure we have datetime
      .map((game: any) => ({
        id: game.id.toString(),
        datetime: game.datetime,
        title: `vs ${game.opponent_name || 'TBD'}`,
        opponent: {
          name: game.opponent_name || 'TBD',
          customLogo: game.opponent?.custom_logo ? {
            url: game.opponent.custom_logo.url
          } : undefined,
          officialLogo: game.opponent?.official_logo ? {
            url: game.opponent.official_logo.url
          } : undefined
        },
        location: game.location || '',
        result: game.status_text || '',
        status: game.status || 'scheduled'
      }))
      .sort((a: HuskerGame, b: HuskerGame) => 
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );

    // Process US Soccer data
    const usMatches = usData?.result?.data?.json?.matches || [];
    const usMens: USNTGame[] = [];
    const usWomens: USNTGame[] = [];



    usMatches.forEach((match: any) => {
      // Extract team info from contestants array
      const contestants = match.contestants || [];
      const homeTeam = contestants[0] || {};
      const awayTeam = contestants[1] || {};
      
      // Extract team info from contestants array  
      const description = match.description || '';
      const homeName = homeTeam.name || homeTeam.officialName || '';
      const awayName = awayTeam.name || awayTeam.officialName || '';
      
      const game: USNTGame = {
        id: match.matchId || match.id || Math.random().toString(),
        date: match.date || match.kickOffTime,
        homeTeam: {
          name: homeName || 'TBD',
          logo: homeTeam.crest?.brandedBackground?.url || homeTeam.logo
        },
        awayTeam: {
          name: awayName || 'TBD', 
          logo: awayTeam.crest?.brandedBackground?.url || awayTeam.logo
        },
        competition: {
          name: match.competition?.name || 'International Friendly'
        },
        venue: match.venue ? {
          name: match.venue.longName || match.venue.shortName || match.venue.name,
          city: match.venue.location || match.venue.city,
          country: match.venue.country
        } : undefined,
        status: match.status === 1 ? 'scheduled' : (match.status || 'scheduled')
      };

      // Determine if it's men's or women's based on multiple criteria
      const matchName = match.name || '';
      const matchFeedUrl = match.matchFeedUrl || '';
      const competitionUrl = match.sitecoreData?.competition?.competitionUrl || '';
      const crestAlt = homeTeam.crest?.brandedBackground?.alt || awayTeam.crest?.brandedBackground?.alt || '';
      
      // Simple check - if contestant ID is the USWNT ID, it's a women's game
      const isWomens = homeTeam.id === 'e70zl10x0ayu7y10ry0wi465a' ||
                      awayTeam.id === 'e70zl10x0ayu7y10ry0wi465a' ||
                      description.toLowerCase().includes('uswnt') || 
                      description.toLowerCase().includes('women') ||
                      matchName.toLowerCase().includes('uswnt') ||
                      matchName.toLowerCase().includes('women') ||
                      homeName.toLowerCase().includes('uswnt') || 
                      awayName.toLowerCase().includes('uswnt') ||
                      homeName.toLowerCase().includes('women') ||
                      awayName.toLowerCase().includes('women') ||
                      match.competition?.name?.toLowerCase().includes('women') ||
                      // Check match feed URL for uswnt
                      matchFeedUrl.toLowerCase().includes('uswnt') ||
                      // Check competition URL for uswnt
                      competitionUrl.toLowerCase().includes('uswnt') ||
                      // Check crest alt text for WNT
                      crestAlt.toLowerCase().includes('wnt') ||
                      homeTeam.id === 'optastub_deaf-wnt' ||
                      awayTeam.id === 'optastub_deaf-wnt';
      
      // Primary check: USWNT contestant ID
      if (homeTeam.id === 'e70zl10x0ayu7y10ry0wi465a' || awayTeam.id === 'e70zl10x0ayu7y10ry0wi465a') {
        usWomens.push(game);
      } else if (isWomens) {
        usWomens.push(game);
      } else {
        // Only add men's games if they don't contain youth/age group indicators
        const isYouthGame = description.toLowerCase().includes('u17') ||
                           description.toLowerCase().includes('u19') ||
                           description.toLowerCase().includes('u20') ||
                           description.toLowerCase().includes('u23') ||
                           homeName.toLowerCase().includes('u17') ||
                           awayName.toLowerCase().includes('u17');
        
        if (!isYouthGame) {
          usMens.push(game);
        }
      }
    });

    const response: SoccerScheduleResponse = {
      huskerWomens,
      usMens: usMens.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      usWomens: usWomens.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      lastUpdated: new Date().toISOString()
    };

    const responseJson = JSON.stringify(response);
    
    // Cache the response
    if (env.SCHEDULE_CACHE) {
      await env.SCHEDULE_CACHE.put(cacheKey, responseJson, { expirationTtl: 1800 });
    }

    return new Response(responseJson, { headers });

  } catch (error) {
    console.error('Soccer API error:', error);
    
      // Try to return cached data if available
    const cacheKey = 'soccer-schedule-v7';
      const cached = await env.SCHEDULE_CACHE?.get(cacheKey);
    
    if (cached) {
      return new Response(cached, { headers });
    }

    const errorResponse = {
      error: 'Failed to fetch soccer schedule data',
      message: error instanceof Error ? error.message : 'Unknown error',
      huskerWomens: [],
      usMens: [],
      usWomens: [],
      lastUpdated: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse), { 
      status: 500, 
      headers 
    });
  }
}