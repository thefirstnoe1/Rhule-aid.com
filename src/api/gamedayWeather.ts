// Tomorrow.io Weather API for Game Day Forecasting
// Provides hourly forecasts 4 hours before and after game time

export async function handleGamedayWeatherRequest(request: Request, env: any): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Add a simple test to see if the endpoint is being called
  console.log('=== GAMEDAY WEATHER API CALLED ===');

  try {
    const url = new URL(request.url);
    const location = url.searchParams.get('location');
    const gameTime = url.searchParams.get('gameTime'); // ISO string of game time
    const skipCache = url.searchParams.get('debug') === 'true';
    
    console.log('Gameday Weather API called with:', { location, gameTime, skipCache });
    
    if (!location || !gameTime) {
      console.log('Missing required parameters:', { location: !!location, gameTime: !!gameTime });
      return new Response(JSON.stringify({
        success: false,
        error: 'location and gameTime parameters are required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if we're within 24 hours of game time
    const gameDateTime = new Date(gameTime);
    const now = new Date();
    const hoursUntilGame = (gameDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    console.log('Time check:', { gameDateTime: gameDateTime.toISOString(), now: now.toISOString(), hoursUntilGame });
    
    if (hoursUntilGame > 24 || hoursUntilGame < -8) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tomorrow.io API only used within 24 hours of game time',
        hoursUntilGame: hoursUntilGame
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check cache first (unless debug mode)
    if (!skipCache) {
      const cacheKey = `gameday_weather_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${gameTime}`;
      console.log('Checking cache with key:', cacheKey);
      
      if (env.WEATHER_CACHE) {
        const cached = await env.WEATHER_CACHE.get(cacheKey);
        if (cached) {
          console.log('Returning cached data');
          return new Response(cached, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Get coordinates for the location
    const coordinates = getLocationCoordinates(location);
    console.log('Coordinate lookup result:', { location, coordinates });
    
    if (!coordinates) {
      console.log('No coordinates found for location:', location);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unable to determine coordinates for location'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get weather data from Tomorrow.io
    console.log('Calling Tomorrow.io API...');
    const weatherData = await getTomorrowIOWeatherData(coordinates, gameDateTime, env);
    console.log('Tomorrow.io API returned data');
    
    // Cache for 1 hour (unless debug mode)
    if (!skipCache && env.WEATHER_CACHE) {
      const cacheKey = `gameday_weather_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${gameTime}`;
      await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(weatherData), { expirationTtl: 3600 });
      console.log('Data cached');
    }
    
    return new Response(JSON.stringify(weatherData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Gameday Weather API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', errorMessage);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch gameday weather data',
      details: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getTomorrowIOWeatherData(coordinates: { lat: number; lon: number }, gameTime: Date, env: any) {
  console.log('getTomorrowIOWeatherData called with:', coordinates, gameTime.toISOString());
  
  const apiKey = env.TOMORROW_API_KEY;
  
  console.log('API Key check:', { hasKey: !!apiKey, keyPrefix: apiKey ? apiKey.substring(0, 10) : 'none' });
  
  if (!apiKey || apiKey.startsWith('$') || apiKey.trim() === '') {
    console.log('Tomorrow.io API key not properly configured, returning mock data for testing');
    
    // Return mock data for testing when API key is not configured
    const mockHourly = [];
    for (let i = -4; i <= 4; i++) {
      const hourTime = new Date(gameTime.getTime() + (i * 60 * 60 * 1000));
      mockHourly.push({
        time: hourTime.toISOString(),
        timeLocal: hourTime.toLocaleString('en-US', {
          timeZone: 'America/Chicago',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }),
        temperature: 75 + Math.random() * 10,
        humidity: 60 + Math.random() * 20,
        windSpeed: 5 + Math.random() * 10,
        windDirection: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.floor(Math.random() * 8)],
        weatherDescription: ['Clear', 'Partly Cloudy', 'Mostly Cloudy', 'Light Rain'][Math.floor(Math.random() * 4)],
        precipitationIntensity: Math.random() * 2,
        precipitationProbability: Math.random() * 30,
        uvIndex: Math.random() * 10,
        visibility: 8 + Math.random() * 2,
        isGameTime: i === 0  // Only the exact kickoff hour is marked as game time
      });
    }
    
    console.log('Generated mock data for hours:', mockHourly.map((h: any) => h.timeLocal));
    
    return {
      success: true,
      location: `${coordinates.lat}, ${coordinates.lon}`,
      gameTime: gameTime.toISOString(),
      hourly: mockHourly,
      note: 'Mock data - Tomorrow.io API key not configured'
    };
  }

  // Calculate time range: 4 hours before to 4 hours after game time
  const startTime = new Date(gameTime.getTime() - (4 * 60 * 60 * 1000)); // 4 hours before
  const endTime = new Date(gameTime.getTime() + (4 * 60 * 60 * 1000)); // 4 hours after

  console.log('Time range calculation:', { 
    gameTime: gameTime.toISOString(),
    startTime: startTime.toISOString(), 
    endTime: endTime.toISOString(),
    totalHours: (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
  });

  const baseUrl = 'https://api.tomorrow.io/v4/weather/forecast';
  const params = new URLSearchParams({
    location: `${coordinates.lat},${coordinates.lon}`,
    apikey: apiKey,
    timesteps: 'hourly',
    units: 'imperial',
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    fields: 'temperature,humidity,windSpeed,windDirection,weatherCode,precipitationIntensity,precipitationProbability,uvIndex,visibility'
  });

  const fullUrl = `${baseUrl}?${params.toString()}`;
  console.log('Tomorrow.io API call:', fullUrl.replace(apiKey, 'REDACTED_KEY'));
  
  try {
    const response = await fetch(fullUrl);
    
    console.log('Tomorrow.io response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Tomorrow.io API error response:', errorData);
      throw new Error(`Tomorrow.io API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json() as any;
    console.log('Tomorrow.io response structure:', { 
      hasTimelines: !!data.timelines,
      hasHourly: !!(data.timelines && data.timelines.hourly),
      hourlyCount: data.timelines && data.timelines.hourly ? data.timelines.hourly.length : 0
    });
    
    // Check if we have the expected structure
    if (!data.timelines || !data.timelines.hourly) {
      console.error('Unexpected Tomorrow.io response structure:', data);
      throw new Error('Invalid response structure from Tomorrow.io API');
    }
    
    console.log('Tomorrow.io hourly data count:', data.timelines.hourly.length);
    if (data.timelines.hourly.length > 0) {
      console.log('First hour:', data.timelines.hourly[0].time);
      console.log('Last hour:', data.timelines.hourly[data.timelines.hourly.length - 1].time);
    }
    
    // Filter and format only the hours we want (4 before, kickoff, 4 after = 9 total hours)
    const filteredHourly = data.timelines.hourly
      .map((hour: any) => {
        const hourTime = new Date(hour.time);
        const hoursFromKickoff = (hourTime.getTime() - gameTime.getTime()) / (1000 * 60 * 60);
        
        return {
          time: hour.time,
          timeLocal: hourTime.toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          temperature: Math.round(hour.values.temperature),
          humidity: hour.values.humidity,
          windSpeed: Math.round(hour.values.windSpeed),
          windDirection: getWindDirectionFromDegrees(hour.values.windDirection),
          weatherDescription: getWeatherDescription(hour.values.weatherCode),
          precipitationIntensity: hour.values.precipitationIntensity,
          precipitationProbability: hour.values.precipitationProbability,
          uvIndex: hour.values.uvIndex,
          visibility: hour.values.visibility,
          isGameTime: isWithinGameWindow(hour.time, gameTime),
          hoursFromKickoff: hoursFromKickoff
        };
      })
      .filter((hour: any) => {
        // Only include hours that are within 4 hours before or after kickoff
        return hour.hoursFromKickoff >= -4 && hour.hoursFromKickoff <= 4;
      })
      .sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());

    console.log('Filtered hourly data count:', filteredHourly.length);
    console.log('Hours from kickoff range:', filteredHourly.map((h: any) => h.hoursFromKickoff));
    
    // Format the response for our frontend
    return {
      success: true,
      location: `${coordinates.lat}, ${coordinates.lon}`,
      gameTime: gameTime.toISOString(),
      hourly: filteredHourly.map((hour: any) => {
        // Remove the debugging field before sending to frontend
        const { hoursFromKickoff, ...cleanHour } = hour;
        return cleanHour;
      })
    };
  } catch (error) {
    console.error('Error in getTomorrowIOWeatherData:', error);
    throw error;
  }
}

function getLocationCoordinates(location: string): { lat: number; lon: number } | null {
  const locationLower = location.toLowerCase();
  
  // Known US locations for college football stadiums
  if (locationLower.includes('lincoln') || locationLower.includes('nebraska') || locationLower.includes(' ne')) {
    return { lat: 40.8136, lon: -96.7026 }; // Memorial Stadium, Lincoln, NE
  }
  
  if (locationLower.includes('kansas city') || locationLower.includes('kc') || locationLower.includes('arrowhead')) {
    return { lat: 39.0489, lon: -94.4839 }; // Arrowhead Stadium, Kansas City, MO
  }
  
  if (locationLower.includes('college park') && locationLower.includes('md')) {
    return { lat: 38.9807, lon: -76.9370 }; // SECU Stadium, College Park, MD
  }
  
  if (locationLower.includes('minneapolis') || locationLower.includes('minnesota') || locationLower.includes('huntington bank')) {
    return { lat: 44.9778, lon: -93.2650 }; // Huntington Bank Stadium, Minneapolis, MN
  }
  
  if (locationLower.includes('pasadena') || locationLower.includes('rose bowl')) {
    return { lat: 34.1611, lon: -118.1678 }; // Rose Bowl Stadium, Pasadena, CA
  }
  
  if (locationLower.includes('university park') && locationLower.includes('pa')) {
    return { lat: 40.8120, lon: -77.8560 }; // Beaver Stadium, University Park, PA
  }
  
  if (locationLower.includes('columbus') && locationLower.includes('oh')) {
    return { lat: 39.9612, lon: -82.9988 }; // Ohio Stadium, Columbus, OH
  }
  
  if (locationLower.includes('ann arbor')) {
    return { lat: 42.2808, lon: -83.7430 }; // Michigan Stadium, Ann Arbor, MI
  }
  
  if (locationLower.includes('madison') && locationLower.includes('wi')) {
    return { lat: 43.0731, lon: -89.4012 }; // Camp Randall Stadium, Madison, WI
  }
  
  if (locationLower.includes('champaign') || locationLower.includes('urbana')) {
    return { lat: 40.1106, lon: -88.2073 }; // Memorial Stadium, Champaign, IL
  }
  
  if (locationLower.includes('east lansing') || (locationLower.includes('michigan') && !locationLower.includes('ann arbor'))) {
    return { lat: 42.7280, lon: -84.4820 }; // Spartan Stadium, East Lansing, MI
  }
  
  if (locationLower.includes('evanston') || locationLower.includes('northwestern')) {
    return { lat: 42.0674, lon: -87.6877 }; // Ryan Field, Evanston, IL
  }
  
  if (locationLower.includes('state college') || locationLower.includes('penn state')) {
    return { lat: 40.8120, lon: -77.8560 }; // Beaver Stadium, State College, PA
  }
  
  if (locationLower.includes('piscataway') || locationLower.includes('rutgers')) {
    return { lat: 40.5237, lon: -74.4640 }; // SHI Stadium, Piscataway, NJ
  }
  
  if (locationLower.includes('iowa city') || (locationLower.includes('iowa') && !locationLower.includes('ames'))) {
    return { lat: 41.6611, lon: -91.5302 }; // Kinnick Stadium, Iowa City, IA
  }
  
  if (locationLower.includes('boulder') || (locationLower.includes('colorado') && !locationLower.includes('colorado springs'))) {
    return { lat: 40.0150, lon: -105.2705 }; // Folsom Field, Boulder, CO
  }
  
  return null; // Unknown location
}

function getWindDirectionFromDegrees(degrees: number): string {
  if (!degrees && degrees !== 0) return 'N/A';
  
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index] || 'N/A';
}

function getWeatherDescription(weatherCode: number): string {
  // Tomorrow.io weather codes mapping
  const weatherCodes: { [key: number]: string } = {
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

function isWithinGameWindow(hourTime: string, gameTime: Date): boolean {
  const hourDate = new Date(hourTime);
  const timeDiff = Math.abs(hourDate.getTime() - gameTime.getTime());
  const hoursDiff = timeDiff / (1000 * 60 * 60);
  
  // Mark as game time if within 30 minutes of kickoff
  return hoursDiff <= 0.5;
}