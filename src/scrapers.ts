export interface APPollTeam {
  rank: number;
  team: string;
  points: number;
  firstPlaceVotes?: number;
}

export interface CFPTeam {
  rank: number;
  team: string;
  points?: number;
}

export interface StandingsTeam {
  school: string;
  confWins: number;
  confLosses: number;
  overallWins: number;
  overallLosses: number;
  pointsFor: number;
  pointsAgainst: number;
  homeRecord: string;
  awayRecord: string;
  streak: string;
}

export async function scrapeAPPoll(): Promise<APPollTeam[]> {
  try {
    const response = await fetch('https://www.ncaa.com/rankings/football/fbs/associated-press');
    const html = await response.text();
    
    // Simple regex parsing since we can't use cheerio in Workers
    const teams: APPollTeam[] = [];
    
    // Match table rows with ranking data
    const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>([^<(]+?)(?:\s*\((\d+)\))?<\/td>[\s\S]*?<td[^>]*>(\d+)[\s\S]*?<\/tr>/gi;
    
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const rank = parseInt(match[1]);
      const team = match[2].trim();
      const firstPlaceVotes = match[3] ? parseInt(match[3]) : 0;
      const points = parseInt(match[4]);
      
      if (rank && team && points) {
        teams.push({
          rank,
          team,
          points,
          firstPlaceVotes
        });
      }
    }
    
    return teams.slice(0, 25); // Top 25
  } catch (error) {
    console.error('Error scraping AP Poll:', error);
    return [];
  }
}

export async function scrapeCFPPoll(): Promise<CFPTeam[]> {
  try {
    const response = await fetch('https://www.ncaa.com/rankings/football/fbs/college-football-playoff');
    const html = await response.text();
    
    const teams: CFPTeam[] = [];
    
    // Match table rows with ranking data
    const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>([^<]+?)<\/td>[\s\S]*?<\/tr>/gi;
    
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const rank = parseInt(match[1]);
      const team = match[2].trim();
      
      if (rank && team) {
        teams.push({
          rank,
          team
        });
      }
    }
    
    return teams.slice(0, 25); // Top 25
  } catch (error) {
    console.error('Error scraping CFP Poll:', error);
    return [];
  }
}

export async function scrapeBigTenStandings(): Promise<StandingsTeam[]> {
  try {
    const response = await fetch('https://www.ncaa.com/standings/football/fbs/big-ten');
    const html = await response.text();
    
    const teams: StandingsTeam[] = [];
    
    // Match table rows with standings data - more complex regex for standings table
    const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([^<]+?)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>([^<]*?)<\/td>[\s\S]*?<td[^>]*>([^<]*?)<\/td>[\s\S]*?<td[^>]*>([^<]*?)<\/td>[\s\S]*?<\/tr>/gi;
    
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const school = match[1].trim();
      const confWins = parseInt(match[2]) || 0;
      const confLosses = parseInt(match[3]) || 0;
      const overallWins = parseInt(match[4]) || 0;
      const overallLosses = parseInt(match[5]) || 0;
      const pointsFor = parseInt(match[6]) || 0;
      const pointsAgainst = parseInt(match[7]) || 0;
      const homeRecord = match[8].trim() || '0-0';
      const awayRecord = match[9].trim() || '0-0';
      const streak = match[10].trim() || '';
      
      if (school) {
        teams.push({
          school,
          confWins,
          confLosses,
          overallWins,
          overallLosses,
          pointsFor,
          pointsAgainst,
          homeRecord,
          awayRecord,
          streak
        });
      }
    }
    
    return teams;
  } catch (error) {
    console.error('Error scraping Big Ten standings:', error);
    return [];
  }
}

// Helper function to clean team names
function cleanTeamName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, '') // Remove parentheses and content
    .trim()
    .replace(/\s+/g, ' '); // Normalize whitespace
}