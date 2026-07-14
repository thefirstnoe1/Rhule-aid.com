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
    const hourly = url.searchParams.get('hourly') === 'true';
    const gameTime = url.searchParams.get('gameTime'); // Optional game time for proximity detection
    const source = url.searchParams.get('source');
    const useTomorrowAPI = source === 'tomorrow';
    const useNWSAPI = source === 'nws';
    
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
    const cacheKey = `weather_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${hourly ? 'hourly' : 'daily'}_${useTomorrowAPI ? 'tomorrow' : useNWSAPI ? 'nws' : useHighAccuracyAPI ? 'precise' : 'standard'}`;
    const cached = await readWeatherCache(env, cacheKey);
    
    if (cached) {
      return new Response(cached, {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get weather data with appropriate API priority
    const weatherData = await getWeatherForLocation(location, env, hourly, useHighAccuracyAPI, useTomorrowAPI, useNWSAPI);
    
    // Cache for 30 minutes for high-accuracy, 2 hours for standard
    const cacheTTL = useNWSAPI ? 300 : useTomorrowAPI || useHighAccuracyAPI ? 1800 : 7200;
    if (env.WEATHER_CACHE) {
      await writeWeatherCache(env, cacheKey, JSON.stringify(weatherData), cacheTTL);
    }
    
    return new Response(JSON.stringify(weatherData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Weather API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch weather data'
    }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function getWeatherForLocation(location: string, env: any, hourly: boolean = false, useHighAccuracyAPI: boolean = false, useTomorrowAPI: boolean = false, useNWSAPI: boolean = false) {
  console.log('Getting weather for location:', location, 'hourly:', hourly, 'high-accuracy:', useHighAccuracyAPI, 'tomorrow:', useTomorrowAPI);

  if (useNWSAPI) {
    console.log('Trying NWS latest observation for requested weather source');
    return await getNWSObservationData();
  }
  
  if (useTomorrowAPI) {
    if (!env.TOMORROW_API_KEY) {
      throw new Error('Tomorrow.io API key is not configured');
    }

    console.log('Trying Tomorrow.io API for requested weather source');
    return await getTomorrowWeatherData(location, env, env.TOMORROW_API_KEY, hourly);
  }
  
  // For games within 120 hours, prefer Tomorrow.io API if available
  if (useHighAccuracyAPI && env.TOMORROW_API_KEY) {
    try {
      console.log('Trying Tomorrow.io API for high-accuracy forecast');
      return await getTomorrowWeatherData(location, env, env.TOMORROW_API_KEY, hourly);
    } catch (error) {
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
    } catch (error) {
      console.error('OpenWeather API failed:', error);
      // Fall through to NWS
    }
  }
  
  // Use National Weather Service (free, US only) for Lincoln/Nebraska
  if (location.includes('NE') || location.includes('Nebraska') || location.includes('Lincoln')) {
    try {
      console.log('Trying NWS API for Lincoln, NE');
      return await getNWSWeatherData(hourly);
    } catch (error) {
      console.error('NWS API failed:', error);
      // Fall through to error if no live source succeeds.
    }
  }
  
  throw new Error(`No live weather source available for ${location}`);
}

interface ResolvedLocation {
  latitude: number;
  longitude: number;
  name: string;
  timezone: string;
}

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};

async function readWeatherCache(env: any, key: string): Promise<string | null> {
  if (!env.WEATHER_CACHE) return null;
  try {
    return await env.WEATHER_CACHE.get(key);
  } catch (error) {
    console.error(`Weather cache read failed for ${key}:`, error);
    return null;
  }
}

async function writeWeatherCache(env: any, key: string, value: string, expirationTtl: number): Promise<void> {
  if (!env.WEATHER_CACHE) return;
  try {
    await env.WEATHER_CACHE.put(key, value, { expirationTtl });
  } catch (error) {
    console.error(`Weather cache write failed for ${key}:`, error);
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

function isLincolnNebraska(location: string): boolean {
  const normalized = location.toLowerCase();
  return normalized.includes('lincoln') &&
    (normalized.includes('nebraska') || /\bne\b/.test(normalized));
}

function locationCacheKey(location: string): string {
  return `weather_coordinates_${location.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

function validCoordinates(latitude: unknown, longitude: unknown): latitude is number {
  return typeof latitude === 'number' && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function parseCityState(location: string): { city: string; state: string } {
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`Location must include city and state: ${location}`);
  }
  const city = parts[0];
  const stateValue = parts[parts.length - 1];
  if (!city || !stateValue) {
    throw new Error(`Location must include city and state: ${location}`);
  }
  const stateInput = stateValue.toUpperCase();
  const state = STATE_NAMES[stateInput] || stateValue;
  return { city, state };
}

function localDateKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).reduce<Record<string, string>>((values, part) => {
    if (part.type !== 'literal') values[part.type] = part.value;
    return values;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

async function resolveTomorrowLocation(location: string, env: any): Promise<ResolvedLocation> {
  if (isLincolnNebraska(location)) {
    return { latitude: 40.8136, longitude: -96.7026, name: 'Lincoln, NE', timezone: 'America/Chicago' };
  }

  const cacheKey = locationCacheKey(location);
  const cached = await readWeatherCache(env, cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as Partial<ResolvedLocation>;
      if (validCoordinates(parsed.latitude, parsed.longitude) && typeof parsed.name === 'string' && !!parsed.name &&
        typeof parsed.timezone === 'string' && !!parsed.timezone) {
        return parsed as ResolvedLocation;
      }
    } catch (error) {
      console.error('Invalid cached weather coordinates:', error);
    }
  }

  const { city, state } = parseCityState(location);
  const params = new URLSearchParams({
    name: city,
    count: '10',
    language: 'en',
    countryCode: 'US',
    format: 'json'
  });
  const response = await fetchWithTimeout(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`);
  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding error: ${data.reason || response.statusText}`);
  }

  const result = data.results?.find((candidate: any) =>
    candidate?.country_code === 'US' && typeof candidate.admin1 === 'string' && candidate.admin1.toLowerCase() === state.toLowerCase()
  );
  if (!result || !validCoordinates(result.latitude, result.longitude) || typeof result.timezone !== 'string' || !result.timezone) {
    throw new Error(`Unable to resolve US location: ${location}`);
  }

  const name = [result.name, result.admin1].filter((part: unknown): part is string => typeof part === 'string' && !!part).join(', ') || location;
  const resolved = { latitude: result.latitude, longitude: result.longitude, name, timezone: result.timezone };
  await writeWeatherCache(env, cacheKey, JSON.stringify(resolved), 30 * 24 * 60 * 60);
  return resolved;
}

async function getTomorrowWeatherData(location: string, env: any, apiKey: string, hourly: boolean = false) {
  try {
    const resolvedLocation = await resolveTomorrowLocation(location, env);
    const { latitude: lat, longitude: lon } = resolvedLocation;
    
    const fetchTimeline = async (timestep: 'current' | '1h' | '1d', fields: string) => {
      const params = new URLSearchParams({
        location: `${lat},${lon}`,
        fields,
        timesteps: timestep,
        units: 'imperial',
        timezone: resolvedLocation.timezone,
        apikey: apiKey
      });
      const response = await fetchWithTimeout(`https://api.tomorrow.io/v4/timelines?${params.toString()}`, {}, 15000);
      const data = await response.json() as any;

      if (!response.ok) {
        throw new Error(`Tomorrow.io API error: ${data.message || response.statusText}`);
      }

      const timeline = data.data?.timelines?.find((item: any) => item.timestep === timestep);
      if (!timeline?.intervals?.length) {
        throw new Error(`Invalid Tomorrow.io ${timestep} response structure`);
      }
      return timeline;
    };

    const currentTimeline = await fetchTimeline(
      'current',
      'temperature,weatherCode,windSpeed,windDirection,humidity'
    );
    const currentInterval = currentTimeline.intervals[0];
    const current = currentInterval.values || {};
    
    const response_data: any = {
      success: true,
      location: resolvedLocation.name,
      current: {
        temperature: Math.round(current.temperature ?? 0),
        temperatureUnit: 'F',
        conditions: getWeatherDescription(current.weatherCode),
        humidity: Math.round(current.humidity ?? 0),
        windSpeed: Math.round(current.windSpeed ?? 0),
        windDirection: getWindDirection(current.windDirection),
        lastUpdated: currentInterval.startTime || new Date().toISOString()
      }
    };
    
    if (hourly) {
      const timeline = await fetchTimeline(
        '1h',
        'temperature,weatherCode,precipitationProbability'
      );
      // Return 48 hours of hourly data
      response_data.forecast = timeline.intervals.slice(0, 48).map((interval: any) => {
        const date = new Date(interval.startTime);
        const values = interval.values || {};
        return {
          name: date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            timeZone: resolvedLocation.timezone
          }),
          time: date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            hour12: true,
            timeZone: resolvedLocation.timezone
          }),
          datetime: interval.startTime,
          temperature: Math.round(values.temperature ?? 0),
          temperatureUnit: 'F',
          shortForecast: getWeatherDescription(values.weatherCode),
          precipitationProbability: Math.round(values.precipitationProbability ?? 0),
          isGameDay: false // Will be set by frontend logic
        };
      });
    } else {
      const timeline = await fetchTimeline(
        '1d',
        'temperatureMax,temperatureMin,weatherCodeMax,precipitationProbabilityAvg'
      );
      // Return daily forecast
      response_data.forecast = timeline.intervals.slice(0, 7).map((interval: any) => {
        const date = new Date(interval.startTime);
        const values = interval.values || {};
        return {
          name: date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            timeZone: resolvedLocation.timezone
          }),
          datetime: interval.startTime,
          dateKey: localDateKey(date, resolvedLocation.timezone),
          temperature: Math.round(values.temperatureMax ?? values.temperatureAvg ?? values.temperatureMin ?? 0),
          temperatureUnit: 'F',
          shortForecast: getWeatherDescription(values.weatherCodeMax ?? values.weatherCode),
          precipitationProbability: Math.round(values.precipitationProbabilityAvg ?? 0),
          isGameDay: false // Will be set by frontend logic
        };
      });
    }
    
    return response_data;
  } catch (error) {
    console.error('Tomorrow.io API error:', error);
    throw error;
  }
}

function getWeatherDescription(weatherCode: number): string {
  // Tomorrow.io weather codes to descriptions
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

async function getOpenWeatherData(location: string, apiKey: string, hourly: boolean = false) {
  try {
    // Get current weather
    const currentResponse = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
    );
    const currentData = await currentResponse.json() as any;
    
    if (!currentResponse.ok) {
      throw new Error(`OpenWeather API error: ${currentData.message}`);
    }
    
    // Get forecast data - use hourly endpoint when requested
    let forecastData: any;
    if (hourly) {
      // Use 5-day forecast which includes 3-hour intervals
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
      );
      forecastData = await forecastResponse.json() as any;
    } else {
      // Use daily forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
      );
      forecastData = await forecastResponse.json() as any;
    }
    
    // Format response
    const response: any = {
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
      response.forecast = forecastData.list.slice(0, 16).map((item: any) => {
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
    } else {
      // Return daily forecast (every 8th item = 24 hours apart)
      response.forecast = forecastData.list.slice(0, 35).filter((_: any, index: number) => index % 8 === 0).map((item: any) => {
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
  } catch (error) {
    console.error('OpenWeather error:', error);
    throw error;
  }
}

const NWS_HEADERS = {
  'User-Agent': 'Rhule Aid weather service (https://rhule-aid.com)',
  'Accept': 'application/geo+json'
};

async function fetchNWSJson(url: string): Promise<any> {
  const response = await fetchWithTimeout(url, { headers: NWS_HEADERS }, 10000);
  const data = await response.json() as any;
  if (!response.ok) {
    throw new Error(`NWS API error: ${data?.title || response.statusText}`);
  }
  return data;
}

function requiredMeasurement(value: unknown, unitCode: unknown, expectedUnit: string, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || unitCode !== expectedUnit) {
    throw new Error(`Invalid NWS observation ${field}`);
  }
  return value;
}

function windSpeedMph(value: unknown, unitCode: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Invalid NWS observation wind speed');
  }
  if (unitCode === 'wmoUnit:m_s-1') return value * 2.236936;
  if (unitCode === 'wmoUnit:km_h-1') return value * 0.621371;
  if (unitCode === 'wmoUnit:mi_h-1') return value;
  throw new Error(`Unsupported NWS wind speed unit: ${String(unitCode)}`);
}

async function getNWSObservationData() {
  try {
    const lat = 40.8136;
    const lon = -96.7026;
    const pointsData = await fetchNWSJson(`https://api.weather.gov/points/${lat},${lon}`);
    const observationStations = pointsData?.properties?.observationStations;
    if (typeof observationStations !== 'string' || !observationStations) {
      throw new Error('Invalid NWS points response');
    }

    const stationsData = await fetchNWSJson(observationStations);
    const station = stationsData?.features?.[0]?.properties;
    const stationId = station?.stationIdentifier;
    if (typeof stationId !== 'string' || !/^[A-Z0-9-]+$/.test(stationId)) {
      throw new Error('Invalid NWS observation station response');
    }

    const observation = await fetchNWSJson(`https://api.weather.gov/stations/${encodeURIComponent(stationId)}/observations/latest`);
    const properties = observation?.properties;
    if (!properties || typeof properties !== 'object') {
      throw new Error('Invalid NWS latest observation response');
    }

    const temperatureC = requiredMeasurement(properties.temperature?.value, properties.temperature?.unitCode, 'wmoUnit:degC', 'temperature');
    const windSpeed = windSpeedMph(properties.windSpeed?.value, properties.windSpeed?.unitCode);
    const windDirection = requiredMeasurement(properties.windDirection?.value, properties.windDirection?.unitCode, 'wmoUnit:degree_(angle)', 'wind direction');
    const humidityValue = properties.relativeHumidity?.value;
    const humidity = humidityValue === null
      ? 'N/A'
      : Math.round(requiredMeasurement(humidityValue, properties.relativeHumidity?.unitCode, 'wmoUnit:percent', 'humidity'));
    if (typeof properties.textDescription !== 'string' || !properties.textDescription ||
      typeof properties.timestamp !== 'string' || !properties.timestamp || Number.isNaN(Date.parse(properties.timestamp))) {
      throw new Error('Invalid NWS observation description or timestamp');
    }

    return {
      success: true,
      location: 'Lincoln, NE',
      current: {
        temperature: Math.round((temperatureC * 9 / 5) + 32),
        temperatureUnit: 'F',
        conditions: properties.textDescription,
        humidity,
        windSpeed: Math.round(windSpeed),
        windDirection: getWindDirection(windDirection),
        lastUpdated: properties.timestamp
      }
    };
  } catch (error) {
    console.error('NWS latest observation error:', error);
    throw error;
  }
}

async function getNWSWeatherData(hourly: boolean = false) {
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
    
    const response: any = {
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
      response.forecast = currentData.properties.periods.slice(0, 48).map((period: any) => ({
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
    } else {
      // Return daily forecast
      response.forecast = forecastData.properties.periods.slice(0, 7).map((period: any) => ({
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
  } catch (error) {
    console.error('NWS error:', error);
    throw error;
  }
}

function getWindDirection(degrees: number): string {
  if (!Number.isFinite(degrees)) return 'N/A';
  
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index] || 'N/A';
}
