export async function handleLogoRequest(request, _env) {
    const url = new URL(request.url);
    const teamName = url.searchParams.get('team');
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=86400'
    };
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }
    if (!teamName) {
        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                'Location': '/images/logos/default-logo.png'
            }
        });
    }
    // Map team names to logo URLs
    const logoMap = getTeamLogoMap();
    const normalizedTeam = normalizeTeamName(teamName);
    const logoUrl = logoMap[normalizedTeam];
    if (logoUrl) {
        // Redirect to the actual logo URL
        return new Response(null, {
            status: 302,
            headers: {
                ...corsHeaders,
                'Location': logoUrl
            }
        });
    }
    // Return a generic/default logo if team not found
    return new Response(null, {
        status: 302,
        headers: {
            ...corsHeaders,
            'Location': '/images/logos/default-logo.png'
        }
    });
}
function normalizeTeamName(teamName) {
    const normalized = teamName
        .toLowerCase()
        .trim()
        // Remove common suffixes
        .replace(/\s+(bearcats|zips|panthers|wolverines|spartans|terrapins|golden gophers|wildcats|trojans|bruins|buckeyes|nittany lions|hawkeyes|cornhuskers|aggies|bulldogs|tigers|bears|eagles|cardinals|cowboys|sooners|longhorns|volunteers|commodores|rebels|crimson tide|razorbacks)$/i, '')
        // Remove "university of" and "university" but preserve important "state" names
        .replace(/^(university of|university)\s+/i, '')
        .replace(/\s+(university|college)$/i, '')
        .trim();
    // Special handling for teams where "State" is part of the core name
    if (teamName.toLowerCase().includes('michigan state'))
        return 'michigan state';
    if (teamName.toLowerCase().includes('penn state'))
        return 'penn state';
    if (teamName.toLowerCase().includes('ohio state'))
        return 'ohio state';
    if (teamName.toLowerCase().includes('iowa state'))
        return 'iowa state';
    if (teamName.toLowerCase().includes('kansas state'))
        return 'kansas state';
    if (teamName.toLowerCase().includes('oklahoma state'))
        return 'oklahoma state';
    if (teamName.toLowerCase().includes('arizona state'))
        return 'arizona state';
    if (teamName.toLowerCase().includes('oregon state'))
        return 'oregon state';
    if (teamName.toLowerCase().includes('washington state'))
        return 'washington state';
    if (teamName.toLowerCase().includes('mississippi state'))
        return 'mississippi state';
    if (teamName.toLowerCase().includes('florida state'))
        return 'florida state';
    if (teamName.toLowerCase().includes('north carolina state') || teamName.toLowerCase().includes('nc state'))
        return 'nc state';
    // For other teams, remove trailing "state"
    return normalized.replace(/\s+state$/i, '').trim();
}
function getTeamLogoMap() {
    return {
        // Big Ten Teams
        'nebraska': 'https://a.espncdn.com/i/teamlogos/ncaa/500/158.png',
        'ohio st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
        'ohio state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
        'michigan': 'https://a.espncdn.com/i/teamlogos/ncaa/500/130.png',
        'penn st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        'penn state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/213.png',
        'wisconsin': 'https://a.espncdn.com/i/teamlogos/ncaa/500/275.png',
        'iowa': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2294.png',
        'minnesota': 'https://a.espncdn.com/i/teamlogos/ncaa/500/135.png',
        'illinois': 'https://a.espncdn.com/i/teamlogos/ncaa/500/356.png',
        'northwestern': 'https://a.espncdn.com/i/teamlogos/ncaa/500/77.png',
        'michigan st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
        'michigan state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/127.png',
        'indiana': 'https://a.espncdn.com/i/teamlogos/ncaa/500/84.png',
        'purdue': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png',
        'maryland': 'https://a.espncdn.com/i/teamlogos/ncaa/500/120.png',
        'rutgers': 'https://a.espncdn.com/i/teamlogos/ncaa/500/164.png',
        'oregon': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png',
        'washington': 'https://a.espncdn.com/i/teamlogos/ncaa/500/264.png',
        'ucla': 'https://a.espncdn.com/i/teamlogos/ncaa/500/26.png',
        'southern california': 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
        'usc': 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
        // Nebraska 2025 Schedule Opponents
        'cincinnati': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2132.png', 'akron': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
        // SEC Teams
        'alabama': 'https://a.espncdn.com/i/teamlogos/ncaa/500/333.png',
        'georgia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/61.png',
        'florida': 'https://a.espncdn.com/i/teamlogos/ncaa/500/57.png',
        'lsu': 'https://a.espncdn.com/i/teamlogos/ncaa/500/99.png',
        'tennessee': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png',
        'auburn': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2.png',
        'texas am': 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        'texas a&m': 'https://a.espncdn.com/i/teamlogos/ncaa/500/245.png',
        'kentucky': 'https://a.espncdn.com/i/teamlogos/ncaa/500/96.png',
        'south carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2579.png',
        'arkansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/8.png',
        'mississippi': 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        'ole miss': 'https://a.espncdn.com/i/teamlogos/ncaa/500/145.png',
        'mississippi state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/344.png',
        'missouri': 'https://a.espncdn.com/i/teamlogos/ncaa/500/142.png',
        'vanderbilt': 'https://a.espncdn.com/i/teamlogos/ncaa/500/238.png',
        'texas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/251.png',
        'oklahoma': 'https://a.espncdn.com/i/teamlogos/ncaa/500/201.png',
        // Big 12 Teams
        'kansas': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
        'kansas state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
        'kansas st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2306.png',
        'iowa state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
        'iowa st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/66.png',
        'oklahoma state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
        'oklahoma st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/197.png',
        'texas tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2641.png',
        'baylor': 'https://a.espncdn.com/i/teamlogos/ncaa/500/239.png',
        'tcu': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2628.png',
        'west virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/277.png',
        // ACC Teams
        'clemson': 'https://a.espncdn.com/i/teamlogos/ncaa/500/228.png',
        'florida state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
        'florida st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/52.png',
        'miami': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png',
        'north carolina': 'https://a.espncdn.com/i/teamlogos/ncaa/500/153.png',
        'duke': 'https://a.espncdn.com/i/teamlogos/ncaa/500/150.png',
        'virginia tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/259.png',
        'virginia': 'https://a.espncdn.com/i/teamlogos/ncaa/500/258.png',
        'pittsburgh': 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
        'louisville': 'https://a.espncdn.com/i/teamlogos/ncaa/500/97.png',
        'wake forest': 'https://a.espncdn.com/i/teamlogos/ncaa/500/154.png',
        'georgia tech': 'https://a.espncdn.com/i/teamlogos/ncaa/500/59.png',
        'syracuse': 'https://a.espncdn.com/i/teamlogos/ncaa/500/183.png',
        'nc state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/152.png',
        // PAC-12 Teams  
        'stanford': 'https://a.espncdn.com/i/teamlogos/ncaa/500/24.png',
        'california': 'https://a.espncdn.com/i/teamlogos/ncaa/500/25.png',
        'colorado': 'https://a.espncdn.com/i/teamlogos/ncaa/500/38.png',
        'utah': 'https://a.espncdn.com/i/teamlogos/ncaa/500/254.png',
        'arizona': 'https://a.espncdn.com/i/teamlogos/ncaa/500/12.png',
        'arizona state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'arizona st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/9.png',
        'washington state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        'washington st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/265.png',
        'oregon state': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        'oregon st': 'https://a.espncdn.com/i/teamlogos/ncaa/500/204.png',
        // Independent & Other
        'notre dame': 'https://a.espncdn.com/i/teamlogos/ncaa/500/87.png',
        'byu': 'https://a.espncdn.com/i/teamlogos/ncaa/500/252.png',
        'army': 'https://a.espncdn.com/i/teamlogos/ncaa/500/349.png',
        'navy': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2426.png',
        'air force': 'https://a.espncdn.com/i/teamlogos/ncaa/500/2005.png',
        // FCS and Other Teams (fallback to default for smaller schools)
        'hcu': '/images/logos/default-logo.png',
        'houston christian': '/images/logos/default-logo.png'
    };
}
