export async function scrapeAPPoll() {
    try {
        const response = await fetch('https://www.ncaa.com/rankings/football/fbs/associated-press');
        const html = await response.text();
        // Simple regex parsing since we can't use cheerio in Workers
        const teams = [];
        // Match table rows with ranking data
        const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>([^<(]+?)(?:\s*\((\d+)\))?<\/td>[\s\S]*?<td[^>]*>(\d+)[\s\S]*?<\/tr>/gi;
        let match;
        while ((match = rowRegex.exec(html)) !== null) {
            const rank = match[1] ? parseInt(match[1]) : 0;
            const team = match[2] ? match[2].trim() : '';
            const firstPlaceVotes = match[3] ? parseInt(match[3]) : 0;
            const points = match[4] ? parseInt(match[4]) : 0;
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
    }
    catch (error) {
        console.error('Error scraping AP Poll:', error);
        return [];
    }
}
export async function scrapeCFPPoll() {
    try {
        const response = await fetch('https://www.ncaa.com/rankings/football/fbs/college-football-playoff');
        const html = await response.text();
        const teams = [];
        // Match table rows with ranking data
        const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>(\d+)<\/td>[\s\S]*?<td[^>]*>([^<]+?)<\/td>[\s\S]*?<\/tr>/gi;
        let match;
        while ((match = rowRegex.exec(html)) !== null) {
            const rank = match[1] ? parseInt(match[1]) : 0;
            const team = match[2] ? match[2].trim() : '';
            if (rank && team) {
                teams.push({
                    rank,
                    team
                });
            }
        }
        return teams.slice(0, 25); // Top 25
    }
    catch (error) {
        console.error('Error scraping CFP Poll:', error);
        return [];
    }
}
export async function scrapeBigTenStandings() {
    try {
        const response = await fetch('https://www.ncaa.com/standings/football/fbs/big-ten');
        const html = await response.text();
        const teams = [];
        // Extract only the Big Ten conference section to avoid other conferences
        const bigTenSectionStart = html.indexOf('Big Ten');
        const bigTenSectionEnd = html.indexOf('</table>', bigTenSectionStart);
        const bigTenHTML = html.substring(bigTenSectionStart, bigTenSectionEnd);
        // First extract all team names from the Big Ten section
        const teamNameRegex = /<td class="standings-team">.*?>([^<]+)<\/td>/g;
        let teamMatch;
        const teamNames = [];
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
    }
    catch (error) {
        console.error('Error scraping Big Ten standings:', error);
        return [];
    }
}
