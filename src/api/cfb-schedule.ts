import { ScheduleMatch, Context } from '../types';

interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  season: {
    year: number;
    type: number;
  };
  week: {
    number: number;
  };
  competitions: Array<{
    id: string;
    date: string;
    competitors: Array<{
      id: string;
      type: string;
      order: number;
      homeAway: 'home' | 'away';
      team: {
        id: string;
        location: string;
        name: string;
        abbreviation: string;
        displayName: string;
        shortDisplayName: string;
        color: string;
        logo: string;
        conferenceId?: string;
      };
      score: string;
      curatedRank?: {
        current: number;
      };
    }>;
    status: {
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
        description: string;
        detail: string;
        shortDetail: string;
      };
    };
    venue?: {
      fullName: string;
      address: {
        city: string;
        state?: string;
        country: string;
      };
    };
    broadcasts?: Array<{
      names: string[];
    }>;
    odds?: Array<{
      details: string;
      spread: number;
    }>;
  }>;
}

interface ESPNResponse {
  events: ESPNGame[];
  leagues: Array<{
    calendar: Array<{
      entries: Array<{
        label: string;
        value: string;
      }>;
    }>;
  }>;
}

export async function onRequest(context: Context): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const week = url.searchParams.get('week') || '';
  const date = url.searchParams.get('date') || '';
  
  const cacheKey = `cfb-schedule:${week}:${date}`;
  
  try {
    let cachedData = null;
    if (env.CFB_SCHEDULE_CACHE) {
      cachedData = await env.CFB_SCHEDULE_CACHE.get(cacheKey);
    }
    
    if (cachedData) {
      return new Response(cachedData, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=900'
        }
      });
    }

    let apiUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard';
    
    const params = new URLSearchParams();
    if (week) {
      params.append('week', week);
    }
    if (date) {
      params.append('dates', date);
    }
    
    if (params.toString()) {
      apiUrl += `?${params.toString()}`;
    }

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Rhule-aid.com/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data: ESPNResponse = await response.json();
    const processedGames = processGames(data.events);
    
    const result = {
      games: processedGames,
      weeks: extractWeeks(data),
      lastUpdated: new Date().toISOString()
    };

    const resultString = JSON.stringify(result);
    
    if (env.CFB_SCHEDULE_CACHE) {
      await env.CFB_SCHEDULE_CACHE.put(cacheKey, resultString, {
        expirationTtl: 900 // 15 minutes
      });
    }

    return new Response(resultString, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=900'
      }
    });

  } catch (error) {
    console.error('CFB Schedule API Error:', error);
    
    const fallbackData = {
      games: getFallbackGames(),
      weeks: getFallbackWeeks(),
      lastUpdated: new Date().toISOString(),
      error: 'Live data unavailable, showing fallback data'
    };

    return new Response(JSON.stringify(fallbackData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
}

function processGames(games: ESPNGame[]): ScheduleMatch[] {
  return games.map(game => {
    const competition = game.competitions[0];
    if (!competition) {
      throw new Error('Invalid game data: missing competition');
    }
    
    const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
    const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
    
    if (!homeTeam || !awayTeam) {
      throw new Error('Invalid game data: missing home or away team');
    }

    const gameDate = new Date(competition.date);
    
    return {
      id: game.id,
      date: gameDate.toLocaleDateString(),
      time: gameDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      }),
      datetime: competition.date,
      week: game.week.number,
      homeTeam: {
        name: homeTeam.team.displayName,
        shortName: homeTeam.team.shortDisplayName,
        logo: homeTeam.team.logo,
        score: parseInt(homeTeam.score) || 0,
        rank: homeTeam.curatedRank?.current,
        conference: getConferenceName(homeTeam.team.conferenceId)
      },
      awayTeam: {
        name: awayTeam.team.displayName,
        shortName: awayTeam.team.shortDisplayName,
        logo: awayTeam.team.logo,
        score: parseInt(awayTeam.score) || 0,
        rank: awayTeam.curatedRank?.current,
        conference: getConferenceName(awayTeam.team.conferenceId)
      },
      venue: competition.venue?.fullName || 'TBD',
      location: competition.venue ? 
        `${competition.venue.address.city}, ${competition.venue.address.state || competition.venue.address.country}` : 
        'TBD',
      tv: competition.broadcasts?.[0]?.names?.[0] || 'TBD',
      status: competition.status.type.description,
      isCompleted: competition.status.type.completed,
      spread: competition.odds?.[0]?.details || null
    };
  });
}

function extractWeeks(data: ESPNResponse): Array<{label: string, value: string}> {
  if (!data.leagues?.[0]?.calendar?.[0]?.entries) {
    return getFallbackWeeks();
  }
  
  return data.leagues[0].calendar[0].entries.map(entry => ({
    label: entry.label,
    value: entry.value
  }));
}

function getConferenceName(conferenceId?: string): string {
  const conferenceMap: { [key: string]: string } = {
    '1': 'ACC',
    '4': 'Big 12',
    '5': 'Big Ten',
    '8': 'SEC',
    '9': 'Big East',
    '12': 'Pac-12',
    '17': 'Mountain West',
    '18': 'Independent',
    '37': 'Sun Belt',
    '151': 'American'
  };
  
  return conferenceId ? conferenceMap[conferenceId] || 'Other' : 'Independent';
}

function getFallbackGames(): ScheduleMatch[] {
  return [
    {
      id: 'fallback-1',
      date: new Date().toLocaleDateString(),
      time: '12:00 PM EST',
      datetime: new Date().toISOString(),
      week: 1,
      homeTeam: {
        name: 'Nebraska Cornhuskers',
        shortName: 'Nebraska',
        logo: '/images/logos/nebraska-logo.png',
        score: 0,
        conference: 'Big Ten'
      },
      awayTeam: {
        name: 'Sample Opponent',
        shortName: 'Sample',
        logo: '/images/logos/default-logo.png',
        score: 0,
        conference: 'Other'
      },
      venue: 'Memorial Stadium',
      location: 'Lincoln, NE',
      tv: 'TBD',
      status: 'Scheduled',
      isCompleted: false,
      spread: null
    }
  ];
}

function getFallbackWeeks(): Array<{label: string, value: string}> {
  return Array.from({ length: 16 }, (_, i) => ({
    label: `Week ${i + 1}`,
    value: (i + 1).toString()
  }));
}