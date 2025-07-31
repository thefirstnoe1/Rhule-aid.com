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
    // Check cache for current conditions (5 minutes) and forecast (12 hours) separately
    const currentCacheKey = 'weather-current-lincoln-ne-v2';
    const forecastCacheKey = 'weather-forecast-lincoln-ne-v2';
    
    const [cachedCurrent, cachedForecast] = await Promise.all([
      env.WEATHER_CACHE?.get(currentCacheKey, 'json'),
      env.WEATHER_CACHE?.get(forecastCacheKey, 'json')
    ]);
    
    const now = Date.now();
    const currentCacheValid = cachedCurrent && cachedCurrent.timestamp && (now - cachedCurrent.timestamp) < 300000; // 5 minutes
    const forecastCacheValid = cachedForecast && cachedForecast.timestamp && (now - cachedForecast.timestamp) < 43200000; // 12 hours
    
    // If both are cached and valid, return cached data
    if (currentCacheValid && forecastCacheValid) {
      return Response.json({
        success: true,
        data: {
          location: cachedForecast.data.location,
          current: cachedCurrent.data,
          forecast: cachedForecast.data.forecast,
          lastUpdated: cachedForecast.data.lastUpdated,
          cached: true
        }
      }, { headers: corsHeaders });
    }

    // Fetch fresh weather data from NWS
    const weatherData = await fetchLincolnWeather();
    
    // Check for upcoming game days to mark in forecast
    const gameData = await fetchUpcomingGames();
    const enrichedWeatherData = await enrichWithGameDays(weatherData, gameData);
    
    // Cache current conditions for 5 minutes
    if (!currentCacheValid) {
      await env.WEATHER_CACHE?.put(currentCacheKey, JSON.stringify({
        data: enrichedWeatherData.current,
        timestamp: now
      }));
    }
    
    // Cache forecast for 12 hours
    if (!forecastCacheValid) {
      await env.WEATHER_CACHE?.put(forecastCacheKey, JSON.stringify({
        data: {
          location: enrichedWeatherData.location,
          forecast: enrichedWeatherData.forecast,
          lastUpdated: enrichedWeatherData.lastUpdated
        },
        timestamp: now
      }));
    }

    return Response.json({
      success: true,
      data: {
        ...enrichedWeatherData,
        cached: false
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('NWS Weather fetch error:', error);
    
    // Only use OpenWeatherMap as a true last resort
    if (env.OPENWEATHER_API_KEY) {
      console.log('NWS failed, attempting OpenWeatherMap fallback...');
      try {
        const fallbackWeatherData = await fetchOpenWeatherMapFallback(env.OPENWEATHER_API_KEY);
        
        console.log('OpenWeatherMap fallback successful');
        
        // Cache the fallback result with separate keys but shorter duration due to fallback status
        const fallbackCurrentKey = 'weather-current-fallback-lincoln-ne';
        const fallbackForecastKey = 'weather-forecast-fallback-lincoln-ne';
        
        await Promise.all([
          env.WEATHER_CACHE?.put(fallbackCurrentKey, JSON.stringify({
            data: fallbackWeatherData.current,
            timestamp: Date.now()
          })),
          env.WEATHER_CACHE?.put(fallbackForecastKey, JSON.stringify({
            data: {
              location: fallbackWeatherData.location,
              forecast: fallbackWeatherData.forecast,
              lastUpdated: fallbackWeatherData.lastUpdated
            },
            timestamp: Date.now()
          }))
        ]);

        return Response.json({
          success: true,
          data: {
            ...fallbackWeatherData,
            cached: false,
            source: 'OpenWeatherMap (NWS failed)'
          }
        }, { headers: corsHeaders });
        
      } catch (fallbackError) {
        console.error('OpenWeatherMap fallback also failed:', fallbackError);
        return Response.json({
          success: false,
          error: 'Unable to fetch weather data from NWS or OpenWeatherMap'
        }, { 
          status: 500,
          headers: corsHeaders 
        });
      }
    } else {
      console.error('No OpenWeatherMap API key available for fallback');
      return Response.json({
        success: false,
        error: 'NWS weather data unavailable and no fallback configured'
      }, { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};

async function fetchLincolnWeather() {
  // Lincoln, NE coordinates: 40.8206° N, 96.7056° W (more precise location)
  const lat = 40.8206;
  const lon = -96.7056;
  
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
  
  if (!stationsResponse.ok) {
    console.error(`Failed to fetch observation stations: ${stationsResponse.status}`);
    throw new Error(`Observation stations API error: ${stationsResponse.status}`);
  }
  
  const stationsData = await stationsResponse.json();
  const nearestStationUrl = stationsData.features[0]?.id;
  
  console.log('Nearest observation station URL:', nearestStationUrl);

  if (!nearestStationUrl) {
    throw new Error('No observation station available');
  }

  // Extract just the station code from the full URL
  const nearestStation = nearestStationUrl.split('/').pop();
  console.log('Extracted station code:', nearestStation);

  let currentConditions: CurrentConditions;
  
  if (nearestStation) {
    try {
      const obsResponse = await fetch(
        `https://api.weather.gov/stations/${nearestStation}/observations/latest`,
        { headers }
      );
      
      if (!obsResponse.ok) {
        console.error(`Observations API error: ${obsResponse.status}`);
        throw new Error(`Observations API error: ${obsResponse.status}`);
      }
      
      const obsData = await obsResponse.json();
      const props = obsData.properties;
      
      // Handle potential null values more gracefully
      const tempCelsius = props.temperature?.value;
      const humidity = props.relativeHumidity?.value;
      const windSpeedValue = props.windSpeed?.value;
      const windDirValue = props.windDirection?.value;
      const description = props.textDescription;

      console.log('Raw observation data:', {
        tempCelsius: tempCelsius,
        tempUnit: props.temperature?.unitCode,
        humidity: humidity,
        windSpeed: windSpeedValue,
        windDirection: windDirValue,
        textDescription: description,
        timestamp: props.timestamp
      });

      // Check if we have valid temperature data
      if (tempCelsius === null || tempCelsius === undefined) {
        console.warn('Temperature data is null/undefined from observation station');
        throw new Error('No valid temperature data from observation station');
      }

      const tempFahrenheit = convertCelsiusToFahrenheit(tempCelsius);
      console.log('Converted temperature:', tempFahrenheit);

      if (tempFahrenheit === null || isNaN(tempFahrenheit)) {
        throw new Error('Invalid temperature conversion result');
      }

      currentConditions = {
        temperature: Math.round(tempFahrenheit),
        temperatureUnit: 'F',
        humidity: Math.round(humidity || 50),
        windSpeed: Math.round(convertKmhToMph(windSpeedValue) || 5),
        windDirection: windDirValue ? getWindDirection(windDirValue) : 'Variable',
        conditions: description || 'Partly Cloudy',
        lastUpdated: props.timestamp
      };
      
      console.log('Final current conditions:', currentConditions);
    } catch (err) {
      console.error('Error fetching current conditions:', err);
      console.warn('Current conditions failed, will use OpenWeatherMap fallback');
      throw err; // Throw the error to trigger OpenWeatherMap fallback instead of hardcoded data
    }
  } else {
    console.warn('No observation station found, will use OpenWeatherMap fallback');
    throw new Error('No observation station available');
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

async function fetchOpenWeatherMapFallback(apiKey: string) {
  if (!apiKey) {
    throw new Error('OpenWeatherMap API key not configured');
  }

  // Lincoln, NE coordinates
  const lat = 40.8206;
  const lon = -96.7056;
  
  // Fetch current weather and forecast from OpenWeatherMap
  const [currentResponse, forecastResponse] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`),
    fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`)
  ]);

  if (!currentResponse.ok) {
    throw new Error(`OpenWeatherMap current weather error: ${currentResponse.status}`);
  }
  
  if (!forecastResponse.ok) {
    throw new Error(`OpenWeatherMap forecast error: ${forecastResponse.status}`);
  }

  const [currentData, forecastData] = await Promise.all([
    currentResponse.json(),
    forecastResponse.json()
  ]);

  // Process current conditions
  const current: CurrentConditions = {
    temperature: Math.round(currentData.main.temp),
    temperatureUnit: 'F',
    humidity: currentData.main.humidity,
    windSpeed: Math.round(currentData.wind?.speed || 0),
    windDirection: getWindDirection(currentData.wind?.deg || 0),
    conditions: currentData.weather[0]?.description || 'Unknown',
    lastUpdated: new Date().toISOString()
  };

  // Process 7-day forecast from 5-day/3-hour forecast
  const forecast: DailyForecast[] = [];
  const dailyForecasts = new Map();

  // Group forecasts by date and find the maximum temperature and representative conditions for each day
  forecastData.list.forEach((item: any) => {
    const date = item.dt_txt.split(' ')[0];
    const hour = new Date(item.dt_txt).getHours();
    
    if (!dailyForecasts.has(date)) {
      dailyForecasts.set(date, {
        maxTemp: item.main.temp,
        maxTempItem: item,
        middayItem: null
      });
    }
    
    const daily = dailyForecasts.get(date);
    
    // Update max temperature if this is higher
    if (item.main.temp > daily.maxTemp) {
      daily.maxTemp = item.main.temp;
      daily.maxTempItem = item;
    }
    
    // Store midday item for weather conditions (more representative of the day)
    if (hour >= 12 && hour <= 15 && !daily.middayItem) {
      daily.middayItem = item;
    }
  });

  // Convert to our format (limit to 7 days)
  let dayCount = 0;
  for (const [date, daily] of dailyForecasts) {
    if (dayCount >= 7) break;
    
    // Use midday conditions if available, otherwise use max temp conditions
    const conditionsItem = daily.middayItem || daily.maxTempItem;
    
    const forecastDate = new Date(date);
    const dayName = dayCount === 0 ? 'Today' : 
                   dayCount === 1 ? 'Tomorrow' : 
                   forecastDate.toLocaleDateString('en-US', { weekday: 'long' });

    forecast.push({
      date: date,
      name: dayName,
      temperature: Math.round(daily.maxTemp), // Use maximum temperature for the day
      temperatureUnit: 'F',
      temperatureTrend: null,
      windSpeed: `${Math.round(conditionsItem.wind?.speed || 0)} mph`,
      windDirection: getWindDirection(conditionsItem.wind?.deg || 0),
      shortForecast: conditionsItem.weather[0]?.main || 'Unknown',
      detailedForecast: conditionsItem.weather[0]?.description || 'No description available',
      isDaytime: true,
      precipitationProbability: Math.round((conditionsItem.pop || 0) * 100)
    });
    
    dayCount++;
  }

  return {
    location: 'Lincoln, NE',
    current: current,
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

function convertKmhToMph(kmh: number | null): number | null {
  if (kmh === null) return null;
  return kmh * 0.621371;
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
