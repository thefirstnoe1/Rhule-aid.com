export async function handleLogoRequest(request, env) {
    const url = new URL(request.url);
    const teamName = url.searchParams.get('team');
    if (!teamName) {
        return new Response('Team parameter required', { status: 400 });
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
                'Location': logoUrl,
                'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
            }
        });
    }
    // Return a generic/default logo if team not found
    return new Response(null, {
        status: 302,
        headers: {
            'Location': '/images/logos/default-logo.png',
            'Cache-Control': 'public, max-age=86400'
        }
    });
}
function normalizeTeamName(teamName) {
    return teamName
        .toLowerCase()
        .trim()
        // Remove common suffixes
        .replace(/\s+(bearcats|zips|panthers|wolverines|spartans|terrapins|golden gophers|wildcats|trojans|bruins|buckeyes|nittany lions|hawkeyes|cornhuskers|aggies|bulldogs|tigers|bears|eagles|cardinals|cowboys|sooners|longhorns|volunteers|commodores|rebels|crimson tide|razorbacks)$/i, '')
        // Remove "university of" and "state"
        .replace(/^(university of|university|state)\s+/i, '')
        .replace(/\s+(university|state|college)$/i, '')
        .trim();
}
function getTeamLogoMap() {
    return {
        // Big Ten Teams
        'nebraska': 'https://logos-world.net/wp-content/uploads/2020/05/Nebraska-Cornhuskers-Logo.png',
        'ohio st': 'https://logos-world.net/wp-content/uploads/2020/05/Ohio-State-Buckeyes-Logo.png',
        'ohio state': 'https://logos-world.net/wp-content/uploads/2020/05/Ohio-State-Buckeyes-Logo.png',
        'michigan': 'https://logos-world.net/wp-content/uploads/2020/05/Michigan-Wolverines-Logo.png',
        'penn st': 'https://logos-world.net/wp-content/uploads/2020/05/Penn-State-Nittany-Lions-Logo.png',
        'penn state': 'https://logos-world.net/wp-content/uploads/2020/05/Penn-State-Nittany-Lions-Logo.png',
        'wisconsin': 'https://logos-world.net/wp-content/uploads/2020/05/Wisconsin-Badgers-Logo.png',
        'iowa': 'https://logos-world.net/wp-content/uploads/2020/05/Iowa-Hawkeyes-Logo.png',
        'minnesota': 'https://logos-world.net/wp-content/uploads/2020/05/Minnesota-Golden-Gophers-Logo.png',
        'illinois': 'https://logos-world.net/wp-content/uploads/2020/05/Illinois-Fighting-Illini-Logo.png',
        'northwestern': 'https://logos-world.net/wp-content/uploads/2020/05/Northwestern-Wildcats-Logo.png',
        'michigan st': 'https://logos-world.net/wp-content/uploads/2020/05/Michigan-State-Spartans-Logo.png',
        'michigan state': 'https://logos-world.net/wp-content/uploads/2020/05/Michigan-State-Spartans-Logo.png',
        'indiana': 'https://logos-world.net/wp-content/uploads/2020/05/Indiana-Hoosiers-Logo.png',
        'purdue': 'https://logos-world.net/wp-content/uploads/2020/05/Purdue-Boilermakers-Logo.png',
        'maryland': 'https://logos-world.net/wp-content/uploads/2020/05/Maryland-Terrapins-Logo.png',
        'rutgers': 'https://logos-world.net/wp-content/uploads/2020/05/Rutgers-Scarlet-Knights-Logo.png',
        'oregon': 'https://logos-world.net/wp-content/uploads/2020/05/Oregon-Ducks-Logo.png',
        'washington': 'https://logos-world.net/wp-content/uploads/2020/05/Washington-Huskies-Logo.png',
        'ucla': 'https://logos-world.net/wp-content/uploads/2020/05/UCLA-Bruins-Logo.png',
        'southern california': 'https://logos-world.net/wp-content/uploads/2020/05/USC-Trojans-Logo.png',
        'usc': 'https://logos-world.net/wp-content/uploads/2020/05/USC-Trojans-Logo.png',
        // Common Opponents
        'akron': 'https://logos-world.net/wp-content/uploads/2020/06/Akron-Zips-Logo.png',
        'utep': 'https://logos-world.net/wp-content/uploads/2020/06/UTEP-Miners-Logo.png',
        'northern illinois': 'https://logos-world.net/wp-content/uploads/2020/06/Northern-Illinois-Huskies-Logo.png',
        'northern ill': 'https://logos-world.net/wp-content/uploads/2020/06/Northern-Illinois-Huskies-Logo.png',
        'niu': 'https://logos-world.net/wp-content/uploads/2020/06/Northern-Illinois-Huskies-Logo.png',
        'cincinnati': 'https://logos-world.net/wp-content/uploads/2020/05/Cincinnati-Bearcats-Logo.png',
        'boston college': 'https://logos-world.net/wp-content/uploads/2020/05/Boston-College-Eagles-Logo.png',
        // SEC Teams
        'alabama': 'https://logos-world.net/wp-content/uploads/2020/05/Alabama-Crimson-Tide-Logo.png',
        'georgia': 'https://logos-world.net/wp-content/uploads/2020/05/Georgia-Bulldogs-Logo.png',
        'florida': 'https://logos-world.net/wp-content/uploads/2020/05/Florida-Gators-Logo.png',
        'lsu': 'https://logos-world.net/wp-content/uploads/2020/05/LSU-Tigers-Logo.png',
        'tennessee': 'https://logos-world.net/wp-content/uploads/2020/05/Tennessee-Volunteers-Logo.png',
        'auburn': 'https://logos-world.net/wp-content/uploads/2020/05/Auburn-Tigers-Logo.png',
        'texas am': 'https://logos-world.net/wp-content/uploads/2020/05/Texas-AM-Aggies-Logo.png',
        'texas a&m': 'https://logos-world.net/wp-content/uploads/2020/05/Texas-AM-Aggies-Logo.png',
        'kentucky': 'https://logos-world.net/wp-content/uploads/2020/05/Kentucky-Wildcats-Logo.png',
        'south carolina': 'https://logos-world.net/wp-content/uploads/2020/05/South-Carolina-Gamecocks-Logo.png',
        'arkansas': 'https://logos-world.net/wp-content/uploads/2020/05/Arkansas-Razorbacks-Logo.png',
        'mississippi': 'https://logos-world.net/wp-content/uploads/2020/05/Ole-Miss-Rebels-Logo.png',
        'ole miss': 'https://logos-world.net/wp-content/uploads/2020/05/Ole-Miss-Rebels-Logo.png',
        'mississippi state': 'https://logos-world.net/wp-content/uploads/2020/05/Mississippi-State-Bulldogs-Logo.png',
        'missouri': 'https://logos-world.net/wp-content/uploads/2020/05/Missouri-Tigers-Logo.png',
        'vanderbilt': 'https://logos-world.net/wp-content/uploads/2020/05/Vanderbilt-Commodores-Logo.png',
        'texas': 'https://logos-world.net/wp-content/uploads/2020/05/Texas-Longhorns-Logo.png',
        'oklahoma': 'https://logos-world.net/wp-content/uploads/2020/05/Oklahoma-Sooners-Logo.png',
        // Big 12 Teams
        'kansas': 'https://logos-world.net/wp-content/uploads/2020/05/Kansas-Jayhawks-Logo.png',
        'kansas state': 'https://logos-world.net/wp-content/uploads/2020/05/Kansas-State-Wildcats-Logo.png',
        'kansas st': 'https://logos-world.net/wp-content/uploads/2020/05/Kansas-State-Wildcats-Logo.png',
        'iowa state': 'https://logos-world.net/wp-content/uploads/2020/05/Iowa-State-Cyclones-Logo.png',
        'iowa st': 'https://logos-world.net/wp-content/uploads/2020/05/Iowa-State-Cyclones-Logo.png',
        'oklahoma state': 'https://logos-world.net/wp-content/uploads/2020/05/Oklahoma-State-Cowboys-Logo.png',
        'oklahoma st': 'https://logos-world.net/wp-content/uploads/2020/05/Oklahoma-State-Cowboys-Logo.png',
        'texas tech': 'https://logos-world.net/wp-content/uploads/2020/05/Texas-Tech-Red-Raiders-Logo.png',
        'baylor': 'https://logos-world.net/wp-content/uploads/2020/05/Baylor-Bears-Logo.png',
        'tcu': 'https://logos-world.net/wp-content/uploads/2020/05/TCU-Horned-Frogs-Logo.png',
        'west virginia': 'https://logos-world.net/wp-content/uploads/2020/05/West-Virginia-Mountaineers-Logo.png',
        // ACC Teams
        'clemson': 'https://logos-world.net/wp-content/uploads/2020/05/Clemson-Tigers-Logo.png',
        'florida state': 'https://logos-world.net/wp-content/uploads/2020/05/Florida-State-Seminoles-Logo.png',
        'florida st': 'https://logos-world.net/wp-content/uploads/2020/05/Florida-State-Seminoles-Logo.png',
        'miami': 'https://logos-world.net/wp-content/uploads/2020/05/Miami-Hurricanes-Logo.png',
        'north carolina': 'https://logos-world.net/wp-content/uploads/2020/05/North-Carolina-Tar-Heels-Logo.png',
        'duke': 'https://logos-world.net/wp-content/uploads/2020/05/Duke-Blue-Devils-Logo.png',
        'virginia tech': 'https://logos-world.net/wp-content/uploads/2020/05/Virginia-Tech-Hokies-Logo.png',
        'virginia': 'https://logos-world.net/wp-content/uploads/2020/05/Virginia-Cavaliers-Logo.png',
        'pittsburgh': 'https://logos-world.net/wp-content/uploads/2020/05/Pittsburgh-Panthers-Logo.png',
        'louisville': 'https://logos-world.net/wp-content/uploads/2020/05/Louisville-Cardinals-Logo.png',
        'wake forest': 'https://logos-world.net/wp-content/uploads/2020/05/Wake-Forest-Demon-Deacons-Logo.png',
        'georgia tech': 'https://logos-world.net/wp-content/uploads/2020/05/Georgia-Tech-Yellow-Jackets-Logo.png',
        'syracuse': 'https://logos-world.net/wp-content/uploads/2020/05/Syracuse-Orange-Logo.png',
        'nc state': 'https://logos-world.net/wp-content/uploads/2020/05/NC-State-Wolfpack-Logo.png',
        // PAC-12 Teams  
        'stanford': 'https://logos-world.net/wp-content/uploads/2020/05/Stanford-Cardinal-Logo.png',
        'california': 'https://logos-world.net/wp-content/uploads/2020/05/California-Golden-Bears-Logo.png',
        'colorado': 'https://logos-world.net/wp-content/uploads/2020/05/Colorado-Buffaloes-Logo.png',
        'utah': 'https://logos-world.net/wp-content/uploads/2020/05/Utah-Utes-Logo.png',
        'arizona': 'https://logos-world.net/wp-content/uploads/2020/05/Arizona-Wildcats-Logo.png',
        'arizona state': 'https://logos-world.net/wp-content/uploads/2020/05/Arizona-State-Sun-Devils-Logo.png',
        'arizona st': 'https://logos-world.net/wp-content/uploads/2020/05/Arizona-State-Sun-Devils-Logo.png',
        'washington state': 'https://logos-world.net/wp-content/uploads/2020/05/Washington-State-Cougars-Logo.png',
        'washington st': 'https://logos-world.net/wp-content/uploads/2020/05/Washington-State-Cougars-Logo.png',
        'oregon state': 'https://logos-world.net/wp-content/uploads/2020/05/Oregon-State-Beavers-Logo.png',
        'oregon st': 'https://logos-world.net/wp-content/uploads/2020/05/Oregon-State-Beavers-Logo.png',
        // Independent & Other
        'notre dame': 'https://logos-world.net/wp-content/uploads/2020/05/Notre-Dame-Fighting-Irish-Logo.png',
        'byu': 'https://logos-world.net/wp-content/uploads/2020/05/BYU-Cougars-Logo.png',
        'army': 'https://logos-world.net/wp-content/uploads/2020/06/Army-Black-Knights-Logo.png',
        'navy': 'https://logos-world.net/wp-content/uploads/2020/06/Navy-Midshipmen-Logo.png',
        'air force': 'https://logos-world.net/wp-content/uploads/2020/06/Air-Force-Falcons-Logo.png'
    };
}
