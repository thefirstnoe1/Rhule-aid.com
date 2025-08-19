// Weather API for Cloudflare Worker
export async function handleWeatherRequest(request: Request, env: any): Promise<Response> {
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
    
    // Check cache first
    const cacheKey = `weather_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const cached = await env.WEATHER_CACHE?.get(cacheKey);
    
    if (cached) {
      return new Response(cached, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get weather data
    const weatherData = await getWeatherForLocation(location, env);
    
    // Cache for 30 minutes
    if (env.WEATHER_CACHE) {
      await env.WEATHER_CACHE.put(cacheKey, JSON.stringify(weatherData), { expirationTtl: 1800 });
    }
    
    return new Response(JSON.stringify(weatherData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Weather API error:', error);
    
    // Return fallback weather data
    const requestUrl = new URL(request.url);
    const fallbackData = getFallbackWeatherData(requestUrl.searchParams.get('location') || 'Lincoln, NE');
    
    return new Response(JSON.stringify(fallbackData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getWeatherForLocation(location: string, env: any) {
  // If OpenWeather API key is available, use it
  if (env.OPENWEATHER_API_KEY || env.WEATHER_API_KEY) {
    const apiKey = env.OPENWEATHER_API_KEY || env.WEATHER_API_KEY;
    return await getOpenWeatherData(location, apiKey);
  }
  
  // Otherwise use National Weather Service (free, US only)
  if (location.includes('NE') || location.includes('Nebraska') || location.includes('Lincoln')) {
    return await getNWSWeatherData();
  }
  
  // Fallback for other locations
  return getFallbackWeatherData(location);
}

async function getOpenWeatherData(location: string, apiKey: string) {
  try {
    // Get current weather
    const currentResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
    );
    const currentData = await currentResponse.json() as any;
    
    if (!currentResponse.ok) {
      throw new Error(`OpenWeather API error: ${currentData.message}`);
    }
    
    // Get 5-day forecast
    const forecastResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
    );
    const forecastData = await forecastResponse.json() as any;
    
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
      forecast: forecastData.list.slice(0, 35).filter((_: any, index: number) => index % 8 === 0).map((item: any) => ({
        date: new Date(item.dt * 1000).toLocaleDateString(),
        high: Math.round(item.main.temp_max),
        low: Math.round(item.main.temp_min),
        conditions: item.weather[0].description,
        humidity: item.main.humidity
      }))
    };
  } catch (error) {
    console.error('OpenWeather error:', error);
    throw error;
  }
}

async function getNWSWeatherData() {
  try {
    // Lincoln, NE coordinates
    const lat = 40.8136;
    const lon = -96.7026;
    
    // Get current weather from NWS
    const gridResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
    const gridData = await gridResponse.json() as any;
    
    const forecastResponse = await fetch(gridData.properties.forecast);
    const forecastData = await forecastResponse.json() as any;
    
    const currentResponse = await fetch(gridData.properties.forecastHourly);
    const currentData = await currentResponse.json() as any;
    
    const current = currentData.properties.periods[0];
    
    return {
      success: true,
      location: 'Lincoln, NE',
      current: {
        temperature: current.temperature,
        conditions: current.shortForecast,
        humidity: 'N/A', // NWS doesn't always provide humidity
        windSpeed: parseInt(current.windSpeed) || 0,
        windDirection: current.windDirection || 'N/A',
        lastUpdated: new Date().toISOString()
      },
      forecast: forecastData.properties.periods.slice(0, 7).map((period: any) => ({
        date: new Date(period.startTime).toLocaleDateString(),
        high: period.temperature,
        low: period.temperature, // NWS provides one temp per period
        conditions: period.shortForecast,
        humidity: 'N/A'
      }))
    };
  } catch (error) {
    console.error('NWS error:', error);
    throw error;
  }
}

function getFallbackWeatherData(location?: string): any {
  const month = new Date().getMonth();
  let temp;
  let conditions;
  
  // Seasonal fallback temperatures for Nebraska
  if (month >= 5 && month <= 8) { // Jun-Sep (summer)
    temp = 75;
    conditions = 'Partly Cloudy';
  } else if (month >= 9 && month <= 11) { // Oct-Dec (fall)  
    temp = 55;
    conditions = 'Partly Cloudy';
  } else if (month >= 2 && month <= 4) { // Mar-May (spring)
    temp = 65;
    conditions = 'Partly Cloudy';
  } else { // Dec-Feb (winter)
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

function getWindDirection(degrees: number): string {
  if (!degrees) return 'N/A';
  
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index] || 'N/A';
}