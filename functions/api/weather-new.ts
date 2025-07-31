// Cloudflare Pages Function: /functions/api/weather.ts
// Provides weather information using National Weather Service API for Lincoln, NE

interface CurrentConditions {
  temperature: number;
  temperatureUnit: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  conditions: string;
  lastUpdated: string;
}

interface DailyForecast {
  date: string;
  name: string;
  temperature: number;
  temperatureUnit: string;
  temperatureTrend: string | null;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
  precipitationProbability: number;
  isGameDay?: boolean;
}

interface WeatherResponse {
  success: boolean;
  data: {
    location: string;
    current: CurrentConditions;
    forecast: DailyForecast[];
    lastUpdated: string;
    cached: boolean;
  };
  error?: string;
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
    // Check cache (4 hour cache for weather as requested)
    const cacheKey = 'weather-lincoln-ne';
    const cached = await env.WEATHER_CACHE?.get(cacheKey, 'json');
    
    if (cached && cached.timestamp && (Date.now() - cached.timestamp) < 14400000) { // 4 hours
      return Response.json({
        success: true,
        data: {
          ...cached.data,
          cached: true
        }
      }, { headers: corsHeaders });
    }

    // Fetch fresh weather data
    const weatherData = await fetchLincolnWeather();
    
    // Check for upcoming game days to mark in forecast
    const gameData = await fetchUpcomingGames();
    const enrichedWeatherData = await enrichWithGameDays(weatherData, gameData);
    
    // Cache the result for 4 hours
    await env.WEATHER_CACHE?.put(cacheKey, JSON.stringify({
      data: enrichedWeatherData,
      timestamp: Date.now()
    }));

    return Response.json({
      success: true,
      data: {
        ...enrichedWeatherData,
        cached: false
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Weather fetch error:', error);
    
    return Response.json({
      success: false,
      error: 'Unable to fetch weather data',
      data: getFallbackWeather()
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
};

async function fetchLincolnWeather() {
  // Lincoln, NE coordinates: 40.8136° N, 96.7026° W
  const lat = 40.8136;
  const lon = -96.7026;
  
  // User agent as required by NWS API
  const userAgent = 'RhuleAid.com Weather App (contact@rhuleaid.com)';
  
  const headers = {
    'User-Agent': userAgent,
    'Accept': 'application/geo+json'
  };

  // Step 1: Get the forecast office and grid coordinates
  const pointsResponse = await fetch(
    `https://api.weather.gov/points/${lat},${lon}`,
    { headers }
  );

  if (!pointsResponse.ok) {
    throw new Error(`NWS Points API error: ${pointsResponse.status}`);
  }

  const pointsData = await pointsResponse.json();
  const forecastUrl = pointsData.properties.forecast;
  const observationStationsUrl = pointsData.properties.observationStations;

  // Step 2: Get current conditions from nearest observation station
  const stationsResponse = await fetch(observationStationsUrl, { headers });
  const stationsData = await stationsResponse.json();
  const nearestStation = stationsData.features[0]?.id;

  let currentConditions: CurrentConditions;
  
  if (nearestStation) {
    try {
      const obsResponse = await fetch(
        `https://api.weather.gov/stations/${nearestStation}/observations/latest`,
        { headers }
      );
      const obsData = await obsResponse.json();
      const props = obsData.properties;

      currentConditions = {
        temperature: Math.round(convertCelsiusToFahrenheit(props.temperature.value) || 70),
        temperatureUnit: 'F',
        humidity: Math.round(props.relativeHumidity.value || 50),
        windSpeed: Math.round(convertMpsToMph(props.windSpeed.value) || 5),
        windDirection: props.windDirection.value ? getWindDirection(props.windDirection.value) : 'Variable',
        conditions: props.textDescription || 'Partly Cloudy',
        lastUpdated: props.timestamp
      };
    } catch (err) {
      console.warn('Could not fetch current conditions, using fallback');
      currentConditions = getFallbackCurrent();
    }
  } else {
    currentConditions = getFallbackCurrent();
  }

  // Step 3: Get 7-day forecast
  const forecastResponse = await fetch(forecastUrl, { headers });
  
  if (!forecastResponse.ok) {
    throw new Error(`NWS Forecast API error: ${forecastResponse.status}`);
  }

  const forecastData = await forecastResponse.json();
  const periods = forecastData.properties.periods.slice(0, 14); // Get 7 days (day/night periods)

  const forecast: DailyForecast[] = [];
  
  // Group day/night periods into daily forecasts
  for (let i = 0; i < periods.length; i += 2) {
    const dayPeriod = periods[i];
    const nightPeriod = periods[i + 1];
    
    if (dayPeriod) {
      forecast.push({
        date: dayPeriod.startTime.split('T')[0],
        name: dayPeriod.name,
        temperature: dayPeriod.temperature,
        temperatureUnit: dayPeriod.temperatureUnit,
        temperatureTrend: dayPeriod.temperatureTrend,
        windSpeed: dayPeriod.windSpeed,
        windDirection: dayPeriod.windDirection,
        shortForecast: dayPeriod.shortForecast,
        detailedForecast: dayPeriod.detailedForecast,
        isDaytime: dayPeriod.isDaytime,
        precipitationProbability: extractPrecipitationProbability(dayPeriod.detailedForecast)
      });
    }
  }

  return {
    location: 'Lincoln, NE',
    current: currentConditions,
    forecast: forecast,
    lastUpdated: new Date().toISOString(),
    cached: false
  };
}

async function fetchUpcomingGames() {
  try {
    // Fetch schedule from our existing API
    const response = await fetch('https://rhule-aid.com/api/schedule');
    const data = await response.json();
    
    if (data.success && data.data) {
      const now = new Date();
      return data.data.filter((game: any) => {
        const gameDate = new Date(game.date);
        return gameDate > now && gameDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Next 7 days
      });
    }
  } catch (error) {
    console.warn('Could not fetch upcoming games:', error);
  }
  return [];
}

async function enrichWithGameDays(weatherData: any, gameData: any[]) {
  const enrichedForecast = weatherData.forecast.map((day: DailyForecast) => {
    const dayDate = day.date;
    const hasGame = gameData.some(game => {
      const gameDate = new Date(game.date).toISOString().split('T')[0];
      return gameDate === dayDate;
    });
    
    return {
      ...day,
      isGameDay: hasGame
    };
  });

  return {
    ...weatherData,
    forecast: enrichedForecast
  };
}

function convertCelsiusToFahrenheit(celsius: number | null): number | null {
  if (celsius === null) return null;
  return (celsius * 9/5) + 32;
}

function convertMpsToMph(mps: number | null): number | null {
  if (mps === null) return null;
  return mps * 2.237;
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 
                     'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round(degrees / 22.5) % 16];
}

function extractPrecipitationProbability(detailedForecast: string): number {
  const match = detailedForecast.match(/(\d+)%.*(?:rain|precipitation|showers|storms)/i);
  return match ? parseInt(match[1]) : 0;
}

function getFallbackCurrent(): CurrentConditions {
  const now = new Date();
  const month = now.getMonth();
  
  // Seasonal defaults for Nebraska
  let temp, conditions;
  if (month >= 8 && month <= 9) { // Aug-Sep
    temp = 75;
    conditions = 'Partly Cloudy';
  } else if (month >= 10 && month <= 11) { // Oct-Nov  
    temp = 55;
    conditions = 'Cool and Crisp';
  } else if (month >= 2 && month <= 4) { // Mar-May
    temp = 65;
    conditions = 'Pleasant';
  } else {
    temp = 45;
    conditions = 'Cold';
  }

  return {
    temperature: temp,
    temperatureUnit: 'F',
    humidity: 60,
    windSpeed: 8,
    windDirection: 'NW',
    conditions: conditions,
    lastUpdated: now.toISOString()
  };
}

function getFallbackWeather() {
  const current = getFallbackCurrent();
  const forecast: DailyForecast[] = [];
  
  // Generate 7 days of fallback forecast
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    
    forecast.push({
      date: date.toISOString().split('T')[0],
      name: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'long' }),
      temperature: current.temperature + (Math.random() - 0.5) * 10,
      temperatureUnit: 'F',
      temperatureTrend: null,
      windSpeed: '5 to 10 mph',
      windDirection: 'NW',
      shortForecast: 'Partly Cloudy',
      detailedForecast: 'Partly cloudy skies. Pleasant weather for outdoor activities.',
      isDaytime: true,
      precipitationProbability: 20
    });
  }

  return {
    location: 'Lincoln, NE',
    current: current,
    forecast: forecast,
    lastUpdated: new Date().toISOString(),
    cached: false
  };
}
