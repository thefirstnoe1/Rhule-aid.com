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
        const hourly = url.searchParams.get('hourly') === 'true';
        const gameTime = url.searchParams.get('gameTime'); // Optional game time for proximity detection
        // Determine if we should use high-accuracy APIs (within 120 hours of game)
        let useHighAccuracyAPI = false;
        if (gameTime) {
            const gameDateTime = new Date(gameTime);
            const now = new Date();
            const hoursUntilGame = (gameDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
            useHighAccuracyAPI = hoursUntilGame <= 120 && hoursUntilGame > 0;
            console.log(`Game in ${hoursUntilGame.toFixed(1)} hours, using high-accuracy API: ${useHighAccuracyAPI}`);
        }
        // Check cache first - separate cache for hourly vs daily
        const cacheKey = `weather_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${hourly ? 'hourly' : 'daily'}_${useHighAccuracyAPI ? 'precise' : 'standard'}`;
        const cached = await env.WEATHER_CACHE?.get(cacheKey);
        if (cached) {
            return new Response(cached, {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
        // Get weather data with appropriate API priority
        const weatherData = await getWeatherForLocation(location, env, hourly, useHighAccuracyAPI);
        // Cache for 30 minutes for high-accuracy, 2 hours for standard
        const cacheTTL = useHighAccuracyAPI ? 1800 : 7200;
        if (env.WEATHER_CACHE) {
            await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(weatherData), { expirationTtl: cacheTTL });
        }
        return new Response(JSON.stringify(weatherData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    catch (error) {
        console.error('Weather API error:', error);
        // Return fallback weather data
        const requestUrl = new URL(request.url);
        const hourly = requestUrl.searchParams.get('hourly') === 'true';
        const fallbackData = getFallbackWeatherData(requestUrl.searchParams.get('location') || 'Lincoln, NE', hourly);
        return new Response(JSON.stringify(fallbackData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
async function getWeatherForLocation(location, env, hourly = false, useHighAccuracyAPI = false) {
    console.log('Getting weather for location:', location, 'hourly:', hourly, 'high-accuracy:', useHighAccuracyAPI);
    // For games within 120 hours, prefer Tomorrow.io API if available
    if (useHighAccuracyAPI && env.TOMORROW_API_KEY) {
        try {
            console.log('Trying Tomorrow.io API for high-accuracy forecast');
            return await getTomorrowWeatherData(location, env.TOMORROW_API_KEY, hourly);
        }
        catch (error) {
            console.error('Tomorrow.io API failed:', error);
            // Fall through to other APIs
        }
    }
    // If OpenWeather API key is available, use it
    if (env.OPENWEATHER_API_KEY || env.WEATHER_API_KEY) {
        try {
            console.log('Trying OpenWeather API');
            const apiKey = env.OPENWEATHER_API_KEY || env.WEATHER_API_KEY;
            return await getOpenWeatherData(location, apiKey, hourly);
        }
        catch (error) {
            console.error('OpenWeather API failed:', error);
            // Fall through to NWS
        }
    }
    // Use National Weather Service (free, US only) for Lincoln/Nebraska
    if (location.includes('NE') || location.includes('Nebraska') || location.includes('Lincoln')) {
        try {
            console.log('Trying NWS API for Lincoln, NE');
            return await getNWSWeatherData(hourly);
        }
        catch (error) {
            console.error('NWS API failed:', error);
            // Fall through to fallback
        }
    }
    // Fallback for other locations or if all APIs fail
    console.log('Using fallback weather data');
    return getFallbackWeatherData(location, hourly);
}
async function getTomorrowWeatherData(location, apiKey, hourly = false) {
    try {
        // For Nebraska games, use Lincoln coordinates
        const lat = location.includes('Lincoln') || location.includes('NE') || location.includes('Nebraska') ? 40.8136 : null;
        const lon = location.includes('Lincoln') || location.includes('NE') || location.includes('Nebraska') ? -96.7026 : null;
        if (!lat || !lon) {
            throw new Error('Tomorrow.io API requires coordinates - location not supported');
        }
        // Get current weather and forecast
        const forecastUrl = `https://api.tomorrow.io/v4/timelines?location=${lat},${lon}&fields=temperature,weatherCode,precipitationProbability,windSpeed,windDirection,humidity&timesteps=${hourly ? '1h' : '1d'}&units=imperial&apikey=${apiKey}`;
        const response = await fetch(forecastUrl);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Tomorrow.io API error: ${data.message || response.statusText}`);
        }
        const timeline = data.data.timelines[0];
        if (!timeline || !timeline.intervals) {
            throw new Error('Invalid Tomorrow.io API response structure');
        }
        const current = timeline.intervals[0].values;
        const response_data = {
            success: true,
            location: 'Lincoln, NE',
            current: {
                temperature: Math.round(current.temperature),
                temperatureUnit: 'F',
                conditions: getWeatherDescription(current.weatherCode),
                humidity: Math.round(current.humidity),
                windSpeed: Math.round(current.windSpeed),
                windDirection: getWindDirection(current.windDirection),
                lastUpdated: new Date().toISOString()
            }
        };
        if (hourly) {
            // Return 48 hours of hourly data
            response_data.forecast = timeline.intervals.slice(0, 48).map((interval) => {
                const date = new Date(interval.startTime);
                return {
                    name: date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'America/Chicago'
                    }),
                    time: date.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        hour12: true,
                        timeZone: 'America/Chicago'
                    }),
                    datetime: interval.startTime,
                    temperature: Math.round(interval.values.temperature),
                    temperatureUnit: 'F',
                    shortForecast: getWeatherDescription(interval.values.weatherCode),
                    precipitationProbability: Math.round(interval.values.precipitationProbability || 0),
                    isGameDay: false // Will be set by frontend logic
                };
            });
        }
        else {
            // Return daily forecast
            response_data.forecast = timeline.intervals.slice(0, 7).map((interval) => {
                const date = new Date(interval.startTime);
                return {
                    name: date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'America/Chicago'
                    }),
                    temperature: Math.round(interval.values.temperature),
                    temperatureUnit: 'F',
                    shortForecast: getWeatherDescription(interval.values.weatherCode),
                    precipitationProbability: Math.round(interval.values.precipitationProbability || 0),
                    isGameDay: false // Will be set by frontend logic
                };
            });
        }
        return response_data;
    }
    catch (error) {
        console.error('Tomorrow.io API error:', error);
        throw error;
    }
}
function getWeatherDescription(weatherCode) {
    // Tomorrow.io weather codes to descriptions
    const weatherCodes = {
        0: 'Unknown',
        1000: 'Clear',
        1001: 'Cloudy',
        1100: 'Mostly Clear',
        1101: 'Partly Cloudy',
        1102: 'Mostly Cloudy',
        2000: 'Fog',
        2100: 'Light Fog',
        3000: 'Light Wind',
        3001: 'Wind',
        3002: 'Strong Wind',
        4000: 'Drizzle',
        4001: 'Rain',
        4200: 'Light Rain',
        4201: 'Heavy Rain',
        5000: 'Snow',
        5001: 'Flurries',
        5100: 'Light Snow',
        5101: 'Heavy Snow',
        6000: 'Freezing Drizzle',
        6001: 'Freezing Rain',
        6200: 'Light Freezing Rain',
        6201: 'Heavy Freezing Rain',
        7000: 'Ice Pellets',
        7101: 'Heavy Ice Pellets',
        7102: 'Light Ice Pellets',
        8000: 'Thunderstorm'
    };
    return weatherCodes[weatherCode] || 'Unknown';
}
async function getOpenWeatherData(location, apiKey, hourly = false) {
    try {
        // Get current weather
        const currentResponse = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`);
        const currentData = await currentResponse.json();
        if (!currentResponse.ok) {
            throw new Error(`OpenWeather API error: ${currentData.message}`);
        }
        // Get forecast data - use hourly endpoint when requested
        let forecastData;
        if (hourly) {
            // Use 5-day forecast which includes 3-hour intervals
            const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`);
            forecastData = await forecastResponse.json();
        }
        else {
            // Use daily forecast
            const forecastResponse = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`);
            forecastData = await forecastResponse.json();
        }
        // Format response
        const response = {
            success: true,
            location: `${currentData.name}, ${currentData.sys.country}`,
            current: {
                temperature: Math.round(currentData.main.temp),
                temperatureUnit: 'F',
                conditions: currentData.weather[0].description,
                humidity: currentData.main.humidity,
                windSpeed: Math.round(currentData.wind.speed),
                windDirection: getWindDirection(currentData.wind.deg),
                lastUpdated: new Date().toISOString()
            }
        };
        if (hourly) {
            // Return 48 hours of 3-hour intervals (16 periods)
            response.forecast = forecastData.list.slice(0, 16).map((item) => {
                const date = new Date(item.dt * 1000);
                return {
                    name: date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'America/Chicago'
                    }),
                    time: date.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        hour12: true,
                        timeZone: 'America/Chicago'
                    }),
                    datetime: date.toISOString(),
                    temperature: Math.round(item.main.temp),
                    temperatureUnit: 'F',
                    shortForecast: item.weather[0].description,
                    precipitationProbability: Math.round((item.pop || 0) * 100),
                    isGameDay: false // Will be set by frontend logic
                };
            });
        }
        else {
            // Return daily forecast (every 8th item = 24 hours apart)
            response.forecast = forecastData.list.slice(0, 35).filter((_, index) => index % 8 === 0).map((item) => {
                const date = new Date(item.dt * 1000);
                return {
                    name: date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'America/Chicago'
                    }),
                    temperature: Math.round(item.main.temp),
                    temperatureUnit: 'F',
                    shortForecast: item.weather[0].description,
                    precipitationProbability: Math.round((item.pop || 0) * 100),
                    isGameDay: false // Will be set by frontend logic
                };
            });
        }
        return response;
    }
    catch (error) {
        console.error('OpenWeather error:', error);
        throw error;
    }
}
async function getNWSWeatherData(hourly = false) {
    try {
        // Lincoln, NE coordinates
        const lat = 40.8136;
        const lon = -96.7026;
        // Get current weather from NWS
        const gridResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
        const gridData = await gridResponse.json();
        const forecastResponse = await fetch(gridData.properties.forecast);
        const forecastData = await forecastResponse.json();
        const currentResponse = await fetch(gridData.properties.forecastHourly);
        const currentData = await currentResponse.json();
        const current = currentData.properties.periods[0];
        const response = {
            success: true,
            location: 'Lincoln, NE',
            current: {
                temperature: current.temperature,
                temperatureUnit: current.temperatureUnit,
                conditions: current.shortForecast,
                humidity: 'N/A', // NWS doesn't always provide humidity
                windSpeed: parseInt(current.windSpeed) || 0,
                windDirection: current.windDirection || 'N/A',
                lastUpdated: new Date().toISOString()
            }
        };
        if (hourly) {
            // Return 48 hours of hourly data
            response.forecast = currentData.properties.periods.slice(0, 48).map((period) => ({
                name: new Date(period.startTime).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'America/Chicago'
                }),
                time: new Date(period.startTime).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    hour12: true,
                    timeZone: 'America/Chicago'
                }),
                datetime: period.startTime,
                temperature: period.temperature,
                temperatureUnit: period.temperatureUnit,
                shortForecast: period.shortForecast,
                precipitationProbability: 0, // NWS hourly doesn't include precipitation probability
                isGameDay: false // Will be set by frontend logic
            }));
        }
        else {
            // Return daily forecast
            response.forecast = forecastData.properties.periods.slice(0, 7).map((period) => ({
                name: new Date(period.startTime).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'America/Chicago'
                }),
                temperature: period.temperature,
                temperatureUnit: period.temperatureUnit,
                shortForecast: period.shortForecast,
                precipitationProbability: 0, // NWS daily may not include precipitation probability
                isGameDay: false // Will be set by frontend logic
            }));
        }
        return response;
    }
    catch (error) {
        console.error('NWS error:', error);
        throw error;
    }
}
function getFallbackWeatherData(location, hourly = false) {
    const now = new Date();
    const month = now.getMonth();
    let baseTemp;
    let conditions;
    // Seasonal fallback temperatures for Nebraska (more realistic for football season)
    if (month >= 5 && month <= 8) { // Jun-Sep (summer/early fall)
        baseTemp = 78; // Start higher for afternoon games
        conditions = 'Partly Cloudy';
    }
    else if (month >= 9 && month <= 11) { // Oct-Dec (fall)  
        baseTemp = 65; // Cooler fall temperatures
        conditions = 'Partly Cloudy';
    }
    else if (month >= 2 && month <= 4) { // Mar-May (spring)
        baseTemp = 68;
        conditions = 'Partly Cloudy';
    }
    else { // Dec-Feb (winter)
        baseTemp = 38;
        conditions = 'Overcast';
    }
    const response = {
        success: true,
        location: location || 'Lincoln, NE',
        current: {
            temperature: baseTemp,
            temperatureUnit: 'F',
            conditions: conditions,
            humidity: 60,
            windSpeed: 8,
            windDirection: 'SW',
            lastUpdated: new Date().toISOString()
        }
    };
    if (hourly) {
        // Generate 48 hours of hourly data with realistic temperature progression
        response.forecast = Array.from({ length: 48 }, (_, i) => {
            const date = new Date(Date.now() + i * 60 * 60 * 1000); // Every hour
            const hourOfDay = date.getHours();
            // Create realistic daily temperature curve
            // Peak around 3-4 PM, coolest around 6-7 AM
            let tempAdjustment;
            if (hourOfDay >= 14 && hourOfDay <= 16) {
                // Peak afternoon hours - warmest
                tempAdjustment = 5;
            }
            else if (hourOfDay >= 18 && hourOfDay <= 22) {
                // Evening cooling - typical game time
                tempAdjustment = Math.max(-8, -2 - (hourOfDay - 18) * 2);
            }
            else if (hourOfDay >= 6 && hourOfDay <= 10) {
                // Morning warming
                tempAdjustment = -5 + (hourOfDay - 6);
            }
            else {
                // Night/early morning - coolest
                tempAdjustment = -8;
            }
            return {
                name: date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'America/Chicago'
                }),
                time: date.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    hour12: true,
                    timeZone: 'America/Chicago'
                }),
                datetime: date.toISOString(),
                temperature: Math.round(baseTemp + tempAdjustment + Math.floor(Math.random() * 4) - 2),
                temperatureUnit: 'F',
                shortForecast: conditions,
                precipitationProbability: Math.floor(Math.random() * 30),
                isGameDay: false // Will be set by frontend logic
            };
        });
    }
    else {
        // Generate 7 days of daily data
        response.forecast = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
            return {
                name: date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'America/Chicago'
                }),
                temperature: baseTemp + Math.floor(Math.random() * 10) - 5,
                temperatureUnit: 'F',
                shortForecast: conditions,
                precipitationProbability: Math.floor(Math.random() * 30),
                isGameDay: false // Will be set by frontend logic
            };
        });
    }
    return response;
}
function getWindDirection(degrees) {
    if (!degrees)
        return 'N/A';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index] || 'N/A';
}
