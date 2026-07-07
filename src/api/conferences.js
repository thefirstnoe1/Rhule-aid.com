export async function handleConferencesRequest(request, env) {
    const url = new URL(request.url);
    const teamName = url.searchParams.get('team');
    if (!teamName) {
        return new Response('Team parameter required', { status: 400 });
    }
    try {
        // Normalize team name for lookup
        const normalizedTeam = normalizeTeamName(teamName);
        // Query the database for the team's conference
        const stmt = env.DB.prepare('SELECT conference FROM teams WHERE LOWER(name) LIKE ? OR LOWER(name) LIKE ? LIMIT 1');
        const result = await stmt.bind(`%${normalizedTeam}%`, `%${teamName.toLowerCase()}%`).first();
        const conference = result?.conference || null;
        const response = {
            team: teamName,
            conference: conference
        };
        return new Response(JSON.stringify(response), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
            }
        });
    }
    catch (error) {
        console.error('Conference API Error:', error);
        return new Response(JSON.stringify({
            team: teamName,
            conference: null,
            error: 'Unable to lookup conference'
        }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    }
}
function normalizeTeamName(teamName) {
    return teamName
        .toLowerCase()
        .trim()
        // Remove common suffixes
        .replace(/\s+(bearcats|zips|panthers|wolverines|spartans|terrapins|golden gophers|wildcats|trojans|bruins|buckeyes|nittany lions|hawkeyes|cornhuskers|aggies|bulldogs|tigers|bears|eagles|cardinals|cowboys|sooners|longhorns|volunteers|commodores|rebels|crimson tide|razorbacks|demon deacons|wolfpack|huskies)$/i, '')
        // Remove "university of" and "state"
        .replace(/^(university of|university|state)\s+/i, '')
        .replace(/\s+(university|state|college)$/i, '')
        .trim();
}
