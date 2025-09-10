export interface APPollTeam {
  rank: number;
  team: string;
  school?: string;
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
    console.log('Fetching AP Poll from ESPN API...');
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings');
    
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as any;
    
    // Find AP Poll in rankings array
    const apPoll = data.rankings?.find((ranking: any) => ranking.type === 'ap' || ranking.name?.includes('AP'));
    
    if (!apPoll || !apPoll.ranks) {
      console.warn('No AP Poll data found in ESPN response');
      return [];
    }
    
    const teams: APPollTeam[] = apPoll.ranks.map((teamData: any) => ({
      rank: teamData.current,
      team: teamData.team.location,
      school: teamData.team.location, // Frontend expects 'school' property
      points: teamData.points || 0,
      firstPlaceVotes: teamData.firstPlaceVotes || 0
    }));
    
    console.log(`Fetched AP Poll for ${apPoll.occurrence?.displayValue || 'current week'}, ${teams.length} teams`);
    return teams.slice(0, 25); // Ensure top 25
  } catch (error) {
    console.error('Error fetching AP Poll from ESPN:', error);
    return [];
  }
}

export async function scrapeCFPPoll(): Promise<CFPTeam[]> {
  try {
    // CFP rankings are not available on ESPN API, only available via CFBD
    // For now, return empty array until CFP rankings are released
    console.log('CFP rankings not yet available (season just started)');
    return [];
  } catch (error) {
    console.error('Error fetching CFP Poll:', error);
    return [];
  }
}

export async function scrapeBigTenStandings(): Promise<StandingsTeam[]> {
  try {
    const response = await fetch('https://www.ncaa.com/standings/football/fbs/big-ten');
    const html = await response.text();
    
    const teams: StandingsTeam[] = [];
    
    // Extract only the Big Ten conference section to avoid other conferences
    const bigTenSectionStart = html.indexOf('Big Ten');
    const bigTenSectionEnd = html.indexOf('</table>', bigTenSectionStart);
    const bigTenHTML = html.substring(bigTenSectionStart, bigTenSectionEnd);
    
    // First extract all team names from the Big Ten section
    const teamNameRegex = /<td class="standings-team">.*?>([^<]+)<\/td>/g;
    let teamMatch;
    const teamNames: string[] = [];
    
    while ((teamMatch = teamNameRegex.exec(bigTenHTML)) !== null) {
      const teamName = teamMatch[1]?.trim();
      if (teamName && teamName.length > 0) {
        teamNames.push(teamName);
      }
    }
    
    // Now extract all the row data (looking for rows with the actual data)
    const rowDataRegex = /<tr[^>]*>[\s\S]*?<td class="standings-team">[\s\S]*?<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>([^<]*?)<\/td>[\s\S]*?<td[^>]*>([^<]*?)<\/td>[\s\S]*?<td[^>]*>([^<]*?)<\/td>[\s\S]*?<\/tr>/g;
    
    let rowMatch;
    let teamIndex = 0;
    
    while ((rowMatch = rowDataRegex.exec(bigTenHTML)) !== null && teamIndex < teamNames.length) {
      const school = teamNames[teamIndex] || '';
      const confWins = rowMatch[1] ? parseInt(rowMatch[1]) || 0 : 0;
      const confLosses = rowMatch[2] ? parseInt(rowMatch[2]) || 0 : 0;
      const overallWins = rowMatch[3] ? parseInt(rowMatch[3]) || 0 : 0;
      const overallLosses = rowMatch[4] ? parseInt(rowMatch[4]) || 0 : 0;
      const pointsFor = rowMatch[5] ? parseInt(rowMatch[5]) || 0 : 0;
      const pointsAgainst = rowMatch[6] ? parseInt(rowMatch[6]) || 0 : 0;
      const homeRecord = rowMatch[7] ? rowMatch[7].trim() || '0-0' : '0-0';
      const awayRecord = rowMatch[8] ? rowMatch[8].trim() || '0-0' : '0-0';
      const streak = rowMatch[9] ? rowMatch[9].trim() || '' : '';
      
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
      
      teamIndex++;
    }
    
    return teams;
  } catch (error) {
    console.error('Error scraping Big Ten standings:', error);
    return [];
  }
}