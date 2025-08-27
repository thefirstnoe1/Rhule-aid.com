// Weather API for Cloudflare Worker
export async function handleWeatherRequest(request, env) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }
    try {
        const url = new URL(request.url);
        const location = url.searchParams.get('location') || 'Lincoln, NE';
        const skipCache = url.searchParams.get('debug') === 'true';
        // Check cache first (unless debug mode)
        if (!skipCache) {
            const cacheKey = `weather_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            const cached = await env.WEATHER_CACHE?.get(cacheKey);
            if (cached) {
                return new Response(cached, {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }
        // Get weather data
        const weatherData = await getWeatherForLocation(location, env);
        // Cache for 30 minutes (unless debug mode)
        if (!skipCache && env.WEATHER_CACHE) {
            const cacheKey = `weather_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(weatherData), { expirationTtl: 1800 });
        }
        return new Response(JSON.stringify(weatherData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        console.error('Weather API error:', error);
        // Return fallback weather data
        const requestUrl = new URL(request.url);
        const fallbackData = getFallbackWeatherData(requestUrl.searchParams.get('location') || 'Lincoln, NE');
        return new Response(JSON.stringify(fallbackData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
async function getWeatherForLocation(location, env) {
    // Try to get coordinates for US locations to use NWS
    const coordinates = getLocationCoordinates(location);
    if (coordinates) {
        try {
            return await getNWSWeatherData(coordinates.lat, coordinates.lon, location);
        }
        catch (error) {
            console.warn('NWS API failed, trying OpenWeather:', error);
        }
    }
    // Check if OpenWeather API key is available and valid as fallback
    const apiKey = env.OPENWEATHER_API_KEY || env.WEATHER_API_KEY;
    if (apiKey && apiKey !== '$OPENWEATHER_API_KEY' && !apiKey.startsWith('$')) {
        try {
            return await getOpenWeatherData(location, apiKey);
        }
        catch (error) {
            console.warn('OpenWeather API failed, using fallback:', error);
        }
    }
    // Final fallback
    return getFallbackWeatherData(location);
}
function getLocationCoordinates(location) {
    const locationLower = location.toLowerCase();
    // Known US locations for college football
    if (locationLower.includes('lincoln') || locationLower.includes('nebraska') || locationLower.includes(' ne')) {
        return { lat: 40.8136, lon: -96.7026 }; // Lincoln, NE
    }
    if (locationLower.includes('kansas city') || locationLower.includes('kc')) {
        return { lat: 39.0997, lon: -94.5786 }; // Kansas City, MO
    }
    if (locationLower.includes('columbia') && locationLower.includes('mo')) {
        return { lat: 38.9517, lon: -92.3341 }; // Columbia, MO
    }
    if (locationLower.includes('boulder') || (locationLower.includes('colorado') && !locationLower.includes('colorado springs'))) {
        return { lat: 40.0150, lon: -105.2705 }; // Boulder, CO
    }
    if (locationLower.includes('iowa city') || (locationLower.includes('iowa') && !locationLower.includes('ames'))) {
        return { lat: 41.6611, lon: -91.5302 }; // Iowa City, IA
    }
    if (locationLower.includes('madison') && locationLower.includes('wi')) {
        return { lat: 43.0731, lon: -89.4012 }; // Madison, WI
    }
    if (locationLower.includes('champaign') || locationLower.includes('urbana')) {
        return { lat: 40.1106, lon: -88.2073 }; // Champaign, IL
    }
    if (locationLower.includes('minneapolis') || locationLower.includes('minnesota')) {
        return { lat: 44.9778, lon: -93.2650 }; // Minneapolis, MN
    }
    if (locationLower.includes('east lansing') || (locationLower.includes('michigan') && !locationLower.includes('ann arbor'))) {
        return { lat: 42.7370, lon: -84.4839 }; // East Lansing, MI
    }
    if (locationLower.includes('evanston') || (locationLower.includes('northwestern'))) {
        return { lat: 42.0451, lon: -87.6877 }; // Evanston, IL
    }
    if (locationLower.includes('columbus') && locationLower.includes('oh')) {
        return { lat: 39.9612, lon: -82.9988 }; // Columbus, OH
    }
    if (locationLower.includes('ann arbor')) {
        return { lat: 42.2808, lon: -83.7430 }; // Ann Arbor, MI
    }
    if (locationLower.includes('state college') || (locationLower.includes('penn state'))) {
        return { lat: 40.7934, lon: -77.8600 }; // State College, PA
    }
    if (locationLower.includes('piscataway') || locationLower.includes('rutgers')) {
        return { lat: 40.5237, lon: -74.4640 }; // Piscataway, NJ
    }
    if (locationLower.includes('college park') && locationLower.includes('md')) {
        return { lat: 38.9807, lon: -76.9370 }; // College Park, MD
    }
    // Add more locations as needed for other Big Ten/Big 12 cities
    return null; // Non-US or unknown location
}
async function getOpenWeatherData(location, apiKey) {
    try {
        // Get current weather
        const currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`);
        const currentData = await currentResponse.json();
        if (!currentResponse.ok) {
            throw new Error(`OpenWeather API error: ${currentData.message}`);
        }
        // Get 5-day forecast
        const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`);
        const forecastData = await forecastResponse.json();
        // Format response
        return {
            success: true,
            location: `${currentData.name}, ${currentData.sys.country}`,
            current: {
                temperature: Math.round(currentData.main.temp),
                conditions: currentData.weather[0].description,
                humidity: currentData.main.humidity,
                windSpeed: Math.round(currentData.wind.speed),
                windDirection: getWindDirection(currentData.wind.deg),
                lastUpdated: new Date().toISOString()
            },
            forecast: forecastData.list.slice(0, 35).filter((_, index) => index % 8 === 0).map((item) => ({
                date: new Date(item.dt * 1000).toLocaleDateString(),
                high: Math.round(item.main.temp_max),
                low: Math.round(item.main.temp_min),
                conditions: item.weather[0].description,
                humidity: item.main.humidity
            }))
        };
    }
    catch (error) {
        console.error('OpenWeather error:', error);
        throw error;
    }
}
async function getNWSWeatherData(lat = 40.8136, lon = -96.7026, locationName = 'Lincoln, NE') {
    try {
        // Get current weather from NWS
        const gridResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
        if (!gridResponse.ok) {
            throw new Error(`NWS points API failed: ${gridResponse.status}`);
        }
        const gridData = await gridResponse.json();
        const forecastResponse = await fetch(gridData.properties.forecast);
        if (!forecastResponse.ok) {
            throw new Error(`NWS forecast API failed: ${forecastResponse.status}`);
        }
        const forecastData = await forecastResponse.json();
        const currentResponse = await fetch(gridData.properties.forecastHourly);
        if (!currentResponse.ok) {
            throw new Error(`NWS hourly API failed: ${currentResponse.status}`);
        }
        const currentData = await currentResponse.json();
        const current = currentData.properties.periods[0];
        return {
            success: true,
            location: locationName,
            current: {
                temperature: current.temperature,
                conditions: current.shortForecast,
                humidity: 'N/A', // NWS doesn't always provide humidity
                windSpeed: parseInt(current.windSpeed) || 0,
                windDirection: current.windDirection || 'N/A',
                lastUpdated: new Date().toISOString()
            },
            forecast: forecastData.properties.periods.slice(0, 7).map((period) => ({
                date: new Date(period.startTime).toLocaleDateString(),
                high: period.temperature,
                low: period.temperature, // NWS provides one temp per period
                conditions: period.shortForecast,
                humidity: 'N/A'
            }))
        };
    }
    catch (error) {
        console.error('NWS error:', error);
        throw error;
    }
}
function getFallbackWeatherData(location) {
    const month = new Date().getMonth();
    let temp;
    let conditions;
    // Seasonal fallback temperatures for Nebraska
    if (month >= 5 && month <= 8) { // Jun-Sep (summer)
        temp = 75;
        conditions = 'Partly Cloudy';
    }
    else if (month >= 9 && month <= 11) { // Oct-Dec (fall)  
        temp = 55;
        conditions = 'Partly Cloudy';
    }
    else if (month >= 2 && month <= 4) { // Mar-May (spring)
        temp = 65;
        conditions = 'Partly Cloudy';
    }
    else { // Dec-Feb (winter)
        temp = 35;
        conditions = 'Overcast';
    }
    return {
        success: true,
        location: location || 'Lincoln, NE',
        current: {
            temperature: temp,
            conditions: conditions,
            humidity: 60,
            windSpeed: 8,
            windDirection: 'SW',
            lastUpdated: new Date().toISOString()
        },
        forecast: Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toLocaleDateString(),
            high: temp + Math.floor(Math.random() * 10) - 5,
            low: temp - 15 + Math.floor(Math.random() * 10),
            conditions: conditions,
            humidity: 60
        }))
    };
}
function getWindDirection(degrees) {
    if (!degrees)
        return 'N/A';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index] || 'N/A';
}
