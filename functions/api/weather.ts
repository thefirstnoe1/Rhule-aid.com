// Cloudflare Pages Function: /functions/api/weather.ts
// Provides weather information for game days in Lincoln, NE

interface WeatherInfo {
  gameDate: string;
  opponent: string;
  location: string;
  temperature: {
    high: number;
    low: number;
    gameTime: number;
  };
  conditions: string;
  precipitation: number;
  windSpeed: number;
  windDirection: string;
  humidity: number;
  recommendation: string;
}

export const onRequestGet = async (context: any) => {
  const { request, env } = context;
  
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
    const gameDate = url.searchParams.get('date');
    
    if (!gameDate) {
      return Response.json({
        success: false,
        error: 'Game date parameter required'
      }, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Check cache (1 hour cache for weather)
    const cacheKey = `weather-${gameDate}`;
    const cached = await env.WEATHER_CACHE?.get(cacheKey, 'json');
    
    if (cached && cached.timestamp && (Date.now() - cached.timestamp) < 3600000) {
      return Response.json({
        success: true,
        data: cached.data,
        cached: true,
        lastUpdated: new Date(cached.timestamp).toISOString()
      }, { headers: corsHeaders });
    }

    // Fetch weather data
    const weatherData = await fetchWeatherForGame(gameDate, env.WEATHER_API_KEY);
    
    // Cache the result
    await env.WEATHER_CACHE?.put(cacheKey, JSON.stringify({
      data: weatherData,
      timestamp: Date.now()
    }));

    return Response.json({
      success: true,
      data: weatherData,
      cached: false,
      lastUpdated: new Date().toISOString()
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Weather fetch error:', error);
    
    // Return fallback weather data
    const fallbackUrl = new URL(request.url);
    return Response.json({
      success: true,
      data: getFallbackWeather(fallbackUrl.searchParams.get('date')),
      cached: false,
      fallback: true,
      message: 'Using estimated weather data'
    }, { headers: corsHeaders });
  }
};

async function fetchWeatherForGame(gameDate: string, apiKey?: string): Promise<WeatherInfo> {
  if (!apiKey) {
    throw new Error('Weather API key not configured');
  }

  // Use Wunderground API for weather data
  const response = await fetch(
    `https://api.weather.com/v1/forecast/daily/10day?geocode=40.8136,-96.7026&format=json&units=e&language=en-US&apiKey=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Find forecast closest to game date
  const gameDateTime = new Date(gameDate);
  const forecasts = data.forecasts;
  
  if (!forecasts || forecasts.length === 0) {
    throw new Error('No weather forecast data available');
  }

  // Find the forecast for the game date
  const targetForecast = forecasts.find((forecast: any) => {
    const forecastDate = new Date(forecast.fcst_valid_local);
    return forecastDate.toDateString() === gameDateTime.toDateString();
  }) || forecasts[0]; // Fallback to first forecast if exact date not found

  return {
    gameDate: gameDate,
    opponent: 'TBD', // Would be passed in or looked up
    location: 'Lincoln, NE',
    temperature: {
      high: Math.round(targetForecast.max_temp || targetForecast.day?.hi || 75),
      low: Math.round(targetForecast.min_temp || targetForecast.night?.lo || 55),
      gameTime: Math.round((targetForecast.max_temp + targetForecast.min_temp) / 2 || 65)
    },
    conditions: targetForecast.day?.phrase_32char || targetForecast.narrative || 'Partly Cloudy',
    precipitation: Math.round((targetForecast.day?.pop || targetForecast.pop || 0)),
    windSpeed: Math.round(targetForecast.day?.wspd || targetForecast.wspd || 5),
    windDirection: targetForecast.day?.wdir_cardinal || targetForecast.wdir_cardinal || 'Variable',
    humidity: targetForecast.day?.rh || targetForecast.rh || 65,
    recommendation: generateWeatherRecommendation(targetForecast)
  };
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
}

function generateWeatherRecommendation(forecast: any): string {
  const temp = forecast.max_temp || forecast.day?.hi || 70;
  const conditions = (forecast.day?.phrase_32char || forecast.narrative || '').toLowerCase();
  const precipitation = forecast.day?.pop || forecast.pop || 0;
  
  if (precipitation > 70) {
    return "Bring rain gear and waterproof clothing. Consider arriving early for covered parking.";
  } else if (temp < 32) {
    return "Bundle up! Bring layers, hand warmers, and insulated boots. Very cold game day conditions.";
  } else if (temp < 50) {
    return "Cool weather expected. Dress in layers and bring a warm jacket or blanket.";
  } else if (temp > 85) {
    return "Hot game day! Bring sunscreen, stay hydrated, and wear light-colored clothing.";
  } else if (conditions.includes('wind') || (forecast.day?.wspd || forecast.wspd || 0) > 15) {
    return "Windy conditions expected. Secure any loose items and dress accordingly.";
  } else {
    return "Great weather for football! Perfect conditions for tailgating and cheering on the Huskers.";
  }
}

function getFallbackWeather(gameDate: string | null): WeatherInfo {
  // Provide reasonable estimates based on Nebraska climate patterns
  const date = gameDate ? new Date(gameDate) : new Date();
  const month = date.getMonth();
  
  let temp, conditions, recommendation;
  
  if (month >= 8 && month <= 9) { // Aug-Sep
    temp = { high: 82, low: 58, gameTime: 75 };
    conditions = "partly cloudy";
    recommendation = "Pleasant fall weather. Perfect for tailgating!";
  } else if (month >= 10 && month <= 11) { // Oct-Nov  
    temp = { high: 65, low: 42, gameTime: 55 };
    conditions = "cool and crisp";
    recommendation = "Cool weather expected. Bring layers and a warm jacket.";
  } else {
    temp = { high: 45, low: 28, gameTime: 38 };
    conditions = "cold";
    recommendation = "Cold weather game! Bundle up and bring hand warmers.";
  }

  return {
    gameDate: gameDate || new Date().toISOString(),
    opponent: 'TBD',
    location: 'Lincoln, NE',
    temperature: temp,
    conditions: conditions,
    precipitation: 20,
    windSpeed: 8,
    windDirection: 'NW',
    humidity: 65,
    recommendation: recommendation
  };
}
