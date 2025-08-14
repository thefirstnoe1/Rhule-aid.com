// Cloudflare Pages Function: /functions/api/weather.ts
// Provides weather information using National Weather Service API for any location

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

interface LocationInfo {
  lat: number;
  lon: number;
  name: string;
  cacheKey: string;
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
    // Parse URL parameters
    const url = new URL(request.url);
    const locationParam = url.searchParams.get('location');
    
    // Determine location coordinates and name
    const locationInfo = getLocationInfo(locationParam);
    
    // Check cache based on location
    const cacheKey = `weather-${locationInfo.cacheKey}-v2`;
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

    // Fetch fresh weather data for the specified location
    const weatherData = await fetchLocationWeather(locationInfo);
    
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
    console.error('NWS Weather fetch error:', error);
    
    // Try OpenWeatherMap as fallback
    try {
      console.log('Attempting OpenWeatherMap fallback...');
      const url = new URL(request.url);
      const locationParam = url.searchParams.get('location');
      const locationInfo = getLocationInfo(locationParam);
      
      const cacheKey = `weather-${locationInfo.cacheKey}`;
      const fallbackWeatherData = await fetchOpenWeatherMapFallback(env.OPENWEATHER_API_KEY, locationInfo);
      
      // Cache the fallback result for 1 hour (shorter than normal due to fallback status)
      await env.WEATHER_CACHE?.put(cacheKey, JSON.stringify({
        data: fallbackWeatherData,
        timestamp: Date.now()
      }));

      return Response.json({
        success: true,
        data: {
          ...fallbackWeatherData,
          cached: false,
          source: 'OpenWeatherMap (fallback)'
        }
      }, { headers: corsHeaders });
      
    } catch (fallbackError) {
      console.error('OpenWeatherMap fallback error:', fallbackError);
      
      const url = new URL(request.url);
      const locationParam = url.searchParams.get('location');
      const locationInfo = getLocationInfo(locationParam);
      
      return Response.json({
        success: false,
        error: 'Unable to fetch weather data from primary or fallback sources',
        data: getHardcodedFallbackWeather(locationInfo)
      }, { 
        status: 500,
        headers: corsHeaders 
      });
    }
  }
};

function getLocationInfo(locationParam: string | null): LocationInfo {
  // Default to Lincoln, NE if no location specified
  if (!locationParam) {
    return {
      lat: 40.8206,
      lon: -96.7056,
      name: 'Lincoln, NE',
      cacheKey: 'lincoln-ne'
    };
  }

  // Parse game location and return coordinates
  const location = locationParam.toLowerCase();
  
  // Stadium mappings with coordinates
  const stadiumMap: { [key: string]: LocationInfo } = {
    'arrowhead stadium, kansas city, mo': { lat: 39.0489, lon: -94.4839, name: 'Kansas City, MO', cacheKey: 'kansas-city-mo' },
    'memorial stadium, lincoln, ne': { lat: 40.8206, lon: -96.7056, name: 'Lincoln, NE', cacheKey: 'lincoln-ne' },
    'secu stadium, college park, md': { lat: 38.9897, lon: -76.9378, name: 'College Park, MD', cacheKey: 'college-park-md' },
    'huntington bank stadium, minneapolis, mn': { lat: 44.9737, lon: -93.2587, name: 'Minneapolis, MN', cacheKey: 'minneapolis-mn' },
    'rose bowl stadium, pasadena, ca': { lat: 34.1611, lon: -118.1676, name: 'Pasadena, CA', cacheKey: 'pasadena-ca' },
    'beaver stadium, university park, pa': { lat: 40.8123, lon: -77.8564, name: 'University Park, PA', cacheKey: 'university-park-pa' }
  };

  // Try to find exact match first
  if (stadiumMap[location]) {
    return stadiumMap[location];
  }

  // Try to find partial matches
  for (const [stadium, info] of Object.entries(stadiumMap)) {
    if (location.includes(stadium.split(',')[0].split(' ').slice(-2).join(' ').toLowerCase()) ||
        location.includes(info.name.toLowerCase())) {
      return info;
    }
  }

  // If no match found, try to extract city/state and use generic coordinates
  const cityStateMatch = location.match(/([^,]+),\s*([^,]+)$/);
  if (cityStateMatch) {
    const [, city, state] = cityStateMatch;
    const cleanCity = city.trim().toLowerCase();
    const cleanState = state.trim().toLowerCase();
    
    // Use some common city coordinates as fallback
    const cityMap: { [key: string]: { lat: number; lon: number } } = {
      'kansas city, mo': { lat: 39.0997, lon: -94.5786 },
      'college park, md': { lat: 38.9897, lon: -76.9378 },
      'minneapolis, mn': { lat: 44.9778, lon: -93.2650 },
      'pasadena, ca': { lat: 34.1478, lon: -118.1445 },
      'university park, pa': { lat: 40.8123, lon: -77.8564 }
    };
    
    const cityKey = `${cleanCity}, ${cleanState}`;
    if (cityMap[cityKey]) {
      return {
        ...cityMap[cityKey],
        name: `${city.trim()}, ${state.trim()}`,
        cacheKey: cityKey.replace(/[^a-z0-9]/g, '-')
      };
    }
  }

  // Default fallback to Lincoln, NE
  return {
    lat: 40.8206,
    lon: -96.7056,
    name: 'Lincoln, NE',
    cacheKey: 'lincoln-ne'
  };
}

async function fetchLocationWeather(locationInfo: LocationInfo) {
  const { lat, lon, name } = locationInfo;
  
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
  const nearestStation = stationsData.features[0]?.id;
  
  console.log('Nearest observation station:', nearestStation);

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
      
      console.log('Raw observation data:', {
        tempCelsius: props.temperature.value,
        tempUnit: props.temperature.unitCode,
        humidity: props.relativeHumidity.value,
        windSpeed: props.windSpeed.value,
        textDescription: props.textDescription,
        timestamp: props.timestamp
      });

      const tempFahrenheit = convertCelsiusToFahrenheit(props.temperature.value);
      console.log('Converted temperature:', tempFahrenheit);

      currentConditions = {
        temperature: Math.round(tempFahrenheit || 70),
        temperatureUnit: 'F',
        humidity: Math.round(props.relativeHumidity.value || 50),
        windSpeed: Math.round(convertKmhToMph(props.windSpeed.value) || 5),
        windDirection: props.windDirection.value ? getWindDirection(props.windDirection.value) : 'Variable',
        conditions: props.textDescription || 'Partly Cloudy',
        lastUpdated: props.timestamp
      };
      
      console.log('Final current conditions:', currentConditions);
    } catch (err) {
      console.error('Error fetching current conditions:', err);
      console.warn('Could not fetch current conditions, using fallback');
      currentConditions = getFallbackCurrent(name);
    }
  } else {
    console.warn('No observation station found, using fallback');
    currentConditions = getFallbackCurrent(name);
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
    location: name,
    current: currentConditions,
    forecast: forecast,
    lastUpdated: new Date().toISOString(),
    cached: false
  };
}

async function fetchOpenWeatherMapFallback(apiKey: string, locationInfo: LocationInfo) {
  if (!apiKey) {
    throw new Error('OpenWeatherMap API key not configured');
  }

  // Use the location info passed in
  const { lat, lon, name } = locationInfo;
  
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

  // Group forecasts by date and take the midday reading for each day
  forecastData.list.forEach((item: any) => {
    const date = item.dt_txt.split(' ')[0];
    const hour = new Date(item.dt_txt).getHours();
    
    // Use midday forecast (around 12 PM) for daily temp
    if (hour >= 12 && hour <= 15) {
      if (!dailyForecasts.has(date) || hour === 12) {
        dailyForecasts.set(date, item);
      }
    }
  });

  // Convert to our format (limit to 7 days)
  let dayCount = 0;
  for (const [date, item] of dailyForecasts) {
    if (dayCount >= 7) break;
    
    const forecastDate = new Date(date);
    const dayName = dayCount === 0 ? 'Today' : 
                   dayCount === 1 ? 'Tomorrow' : 
                   forecastDate.toLocaleDateString('en-US', { weekday: 'long' });

    forecast.push({
      date: date,
      name: dayName,
      temperature: Math.round(item.main.temp),
      temperatureUnit: 'F',
      temperatureTrend: null,
      windSpeed: `${Math.round(item.wind?.speed || 0)} mph`,
      windDirection: getWindDirection(item.wind?.deg || 0),
      shortForecast: item.weather[0]?.main || 'Unknown',
      detailedForecast: item.weather[0]?.description || 'No description available',
      isDaytime: true,
      precipitationProbability: Math.round((item.pop || 0) * 100)
    });
    
    dayCount++;
  }

  return {
    location: name,
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

function getFallbackCurrent(locationName: string): CurrentConditions {
  const now = new Date();
  const month = now.getMonth(); // 0-based (July = 6)
  
  // Seasonal defaults for Nebraska (or use similar defaults for other locations)
  let temp: number, conditions: string;
  if (month >= 5 && month <= 8) { // Jun-Sep (summer)
    temp = 75;
    conditions = 'Partly Cloudy';
  } else if (month >= 9 && month <= 11) { // Oct-Dec (fall)  
    temp = 55;
    conditions = 'Cool and Crisp';
  } else if (month >= 2 && month <= 4) { // Mar-May (spring)
    temp = 65;
    conditions = 'Pleasant';
  } else { // Dec-Feb (winter)
    temp = 35;
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

function getHardcodedFallbackWeather(locationInfo: LocationInfo) {
  const current = getFallbackCurrent(locationInfo.name);
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
    location: locationInfo.name,
    current: current,
    forecast: forecast,
    lastUpdated: new Date().toISOString(),
    cached: false
  };
}