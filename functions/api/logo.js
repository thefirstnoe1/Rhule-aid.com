export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const team = url.searchParams.get('team');
    
    if (!team) {
        return new Response('Team parameter required', { status: 400 });
    }
    
    // Logo mapping with backup URLs
    const logoMap = {
        'Cincinnati Bearcats': [
            'https://loodibee.com/wp-content/uploads/Cincinnati_Bearcats_logo.png',
            'https://logos-world.net/wp-content/uploads/2020/06/Cincinnati-Bearcats-Logo.png'
        ],
        'Akron Zips': [
            'https://loodibee.com/wp-content/uploads/Akron_Zips_logo.png'
        ],
        'Northern Iowa Panthers': [
            'https://loodibee.com/wp-content/uploads/Northern_Iowa_Panthers_logo.png'
        ],
        'Michigan Wolverines': [
            'https://loodibee.com/wp-content/uploads/Michigan_Wolverines_logo.png'
        ],
        'Michigan State Spartans': [
            'https://loodibee.com/wp-content/uploads/Michigan_State_Spartans_logo.png'
        ],
        'Maryland Terrapins': [
            'https://loodibee.com/wp-content/uploads/Maryland_Terrapins_logo.png'
        ],
        'Minnesota Golden Gophers': [
            'https://loodibee.com/wp-content/uploads/Minnesota_Golden_Gophers_logo.png'
        ],
        'Northwestern Wildcats': [
            'https://loodibee.com/wp-content/uploads/Northwestern_Wildcats_logo.png'
        ],
        'USC Trojans': [
            'https://loodibee.com/wp-content/uploads/USC_Trojans_logo.png'
        ],
        'UCLA Bruins': [
            'https://a.espncdn.com/i/teamlogos/ncaa/500/26.png',
            'https://content.sportslogos.net/logos/33/775/full/7872_ucla_bruins-primary-2013.png',
            'https://logos-world.net/wp-content/uploads/2020/06/UCLA-Bruins-Logo.png',
            'https://1000logos.net/wp-content/uploads/2018/11/UCLA-Logo.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/5/52/UCLA_Bruins_logo.svg/150px-UCLA_Bruins_logo.svg.png',
            'https://loodibee.com/wp-content/uploads/UCLA_Bruins_logo.png'
        ],
        'Ohio State Buckeyes': [
            'https://loodibee.com/wp-content/uploads/Ohio_State_Buckeyes_logo.png'
        ],
        'Penn State Nittany Lions': [
            'https://loodibee.com/wp-content/uploads/Penn_State_Nittany_Lions_logo.png'
        ],
        'Iowa Hawkeyes': [
            'https://loodibee.com/wp-content/uploads/Iowa_Hawkeyes_logo.png'
        ]
    };
    
    const cacheKey = `logo:${team}`;
    const cache = caches.default;
    
    // Check cache first
    let cachedResponse = await cache.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // Get logo URLs for this team
    const logoUrls = logoMap[team];
    if (!logoUrls || logoUrls.length === 0) {
        return new Response('Logo not found', { status: 404 });
    }
    
    // Try each URL until one works
    for (const logoUrl of logoUrls) {
        try {
            const logoResponse = await fetch(logoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; CloudflareLogo/1.0)'
                }
            });
            
            if (logoResponse.ok) {
                // Create response with caching headers
                const response = new Response(logoResponse.body, {
                    status: 200,
                    headers: {
                        'Content-Type': logoResponse.headers.get('Content-Type') || 'image/png',
                        'Cache-Control': 'public, max-age=86400, s-maxage=2592000', // 1 day browser, 30 days edge
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET',
                        'Vary': 'Accept-Encoding'
                    }
                });
                
                // Cache the response
                await cache.put(request, response.clone());
                return response;
            }
        } catch (error) {
            console.log(`Failed to fetch logo from ${logoUrl}:`, error);
            continue;
        }
    }
    
    // If all URLs fail, return 404
    return new Response('Logo not available', { status: 404 });
}
