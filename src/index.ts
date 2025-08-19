export interface Env {
  DB: any;
  SCHEDULE_CACHE: any;
  ROSTER_CACHE: any;
  NEWS_CACHE: any;
  WEATHER_CACHE: any;
  RANKINGS_CACHE: any;
  STANDINGS_CACHE: any;
  ASSETS: any;
  OPENWEATHER_API_KEY: string;
}

import { scrapeAPPoll, scrapeCFPPoll, scrapeBigTenStandings } from './scrapers';
import { handleScheduleRequest } from './api/schedule';
import { handleNewsRequest } from './api/news';
import { handleRosterRequest } from './api/roster';
import { handleWeatherRequest } from './api/weather';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle API routes
    if (pathname.startsWith('/api/')) {
      return handleAPIRequest(request, env, pathname);
    }

    // Handle static assets
    if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/images/')) {
      return env.ASSETS.fetch(request);
    }

    // Handle HTML pages
    return handleHTMLRequest(request, env, pathname);
  },

  async scheduled(event: any, env: Env): Promise<void> {
    // Weekly update on Monday at 1am
    if (event.cron === '0 1 * * 1') {
      await updateRankingsAndStandings(env);
    }
  }
};

async function handleAPIRequest(request: Request, env: Env, pathname: string): Promise<Response> {
  try {
    switch (pathname) {
      case '/api/schedule':
        return await handleScheduleRequest(request, env);
      case '/api/news':
        return await handleNewsRequest(request, env);
      case '/api/roster':
        return await handleRosterRequest(request, env);
      case '/api/weather':
        return await handleWeatherRequest(request, env);
      case '/api/rankings/ap':
        return await getRankings(env, 'AP');
      case '/api/rankings/cfp':
        return await getRankings(env, 'CFP');
      case '/api/standings/big-ten':
        return await getStandings(env, 'Big Ten');
      case '/api/update/rankings':
        if (request.method === 'POST') {
          await updateRankingsAndStandings(env);
          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        break;
      default:
        return new Response('Not Found', { status: 404 });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response('Method Not Allowed', { status: 405 });
}

async function handleHTMLRequest(request: Request, env: Env, pathname: string): Promise<Response> {
  let htmlPath = pathname;
  
  // Default routes
  if (pathname === '/') {
    htmlPath = '/index.html';
  }
  
  // Serve HTML files
  if (htmlPath.endsWith('.html') || !htmlPath.includes('.')) {
    if (!htmlPath.endsWith('.html')) {
      htmlPath += '.html';
    }
    return env.ASSETS.fetch(new Request(request.url.replace(pathname, htmlPath)));
  }
  
  return new Response('Not Found', { status: 404 });
}

async function getRankings(env: Env, pollType: string): Promise<Response> {
  const cacheKey = `rankings_${pollType.toLowerCase()}`;
  const cached = await env.RANKINGS_CACHE.get(cacheKey);
  
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get latest rankings from database
  const stmt = env.DB.prepare(
    'SELECT * FROM rankings WHERE poll_type = ? ORDER BY week_date DESC, rank ASC LIMIT 25'
  );
  const result = await stmt.bind(pollType).all();
  
  const rankings = JSON.stringify(result.results);
  
  // Cache for 30 minutes
  await env.RANKINGS_CACHE.put(cacheKey, rankings, { expirationTtl: 1800 });
  
  return new Response(rankings, {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function getStandings(env: Env, conference: string): Promise<Response> {
  const cacheKey = `standings_${conference.toLowerCase().replace(' ', '_')}`;
  const cached = await env.STANDINGS_CACHE.get(cacheKey);
  
  if (cached) {
    return new Response(cached, {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get latest standings from database
  const stmt = env.DB.prepare(
    'SELECT * FROM standings WHERE conference = ? ORDER BY week_date DESC, conference_wins DESC, overall_wins DESC'
  );
  const result = await stmt.bind(conference).all();
  
  const standings = JSON.stringify(result.results);
  
  // Cache for 30 minutes
  await env.STANDINGS_CACHE.put(cacheKey, standings, { expirationTtl: 1800 });
  
  return new Response(standings, {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function updateRankingsAndStandings(env: Env): Promise<void> {
  const currentDate = new Date().toISOString().split('T')[0];
  
  try {
    // Scrape AP Poll
    const apPoll = await scrapeAPPoll();
    if (apPoll && apPoll.length > 0) {
      for (const team of apPoll) {
        const stmt = env.DB.prepare(`
          INSERT OR REPLACE INTO rankings 
          (poll_type, rank, team_name, points, first_place_votes, week_date, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        await stmt.bind('AP', team.rank, team.team, team.points, team.firstPlaceVotes || 0, currentDate, new Date().toISOString()).run();
      }
    }
    
    // Scrape CFP Poll
    const cfpPoll = await scrapeCFPPoll();
    if (cfpPoll && cfpPoll.length > 0) {
      for (const team of cfpPoll) {
        const stmt = env.DB.prepare(`
          INSERT OR REPLACE INTO rankings 
          (poll_type, rank, team_name, points, first_place_votes, week_date, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        await stmt.bind('CFP', team.rank, team.team, team.points || 0, 0, currentDate, new Date().toISOString()).run();
      }
    }
    
    // Scrape Big Ten Standings
    const bigTenStandings = await scrapeBigTenStandings();
    if (bigTenStandings && bigTenStandings.length > 0) {
      for (const team of bigTenStandings) {
        const stmt = env.DB.prepare(`
          INSERT OR REPLACE INTO standings 
          (conference, team_name, conference_wins, conference_losses, overall_wins, overall_losses, 
           points_for, points_against, home_record, away_record, streak, week_date, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        await stmt.bind(
          'Big Ten', team.school, team.confWins || 0, team.confLosses || 0,
          team.overallWins || 0, team.overallLosses || 0, team.pointsFor || 0,
          team.pointsAgainst || 0, team.homeRecord || '0-0', team.awayRecord || '0-0',
          team.streak || '', currentDate, new Date().toISOString()
        ).run();
      }
    }
    
    // Clear caches
    await env.RANKINGS_CACHE.delete('rankings_ap');
    await env.RANKINGS_CACHE.delete('rankings_cfp');
    await env.STANDINGS_CACHE.delete('standings_big_ten');
    
  } catch (error) {
    console.error('Error updating rankings and standings:', error);
  }
}